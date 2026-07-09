import 'dart:convert';

import 'package:drift/drift.dart';

import '../../../core/logging.dart';

/// Newest-first cap on how many history rows any feature reads/renders (F23).
/// Older rows stay on disk but are never loaded, so a runaway history can't
/// balloon memory or decode cost.
const kHistoryLimit = 100;

/// A single history list entry.
///
/// F23: the heavy [payloadJson] is only parsed when [detail] is first accessed
/// (from a visible row builder or a detail view) and then cached. The list
/// mapper builds these from indexed columns only, so scrolling a long history
/// never decodes every payload up front.
class HistoryEntry<D> {
  HistoryEntry({
    required this.id,
    required this.date,
    required this.mode,
    required this.errored,
    required String payloadJson,
    required D Function(Map<String, dynamic> json) decode,
  })  : _payloadJson = payloadJson,
        _decode = decode;

  final String id;
  final DateTime date;
  final String mode;
  final bool errored;

  final String _payloadJson;
  final D Function(Map<String, dynamic> json) _decode;
  D? _detail;

  /// Lazily-decoded payload. Throws if the stored JSON is corrupt — callers
  /// that render this in a list must guard for it (the shared history sheet
  /// does so per-row, so one bad payload degrades a single tile).
  D get detail =>
      _detail ??= _decode(jsonDecode(_payloadJson) as Map<String, dynamic>);
}

/// Generic base for the three tool history stores (scan / tracker / discovery),
/// which share an identical table shape (id, date, mode, payloadJson, errored).
///
/// F64: collapses the previously-triplicated watch/delete/clear logic. Each
/// feature subclass supplies its table, the ordering/id columns, its own
/// `save` (companions differ), and an [entryFromRow] codec that reads columns
/// without decoding the payload.
abstract class HistoryRepository<Tbl extends Table, Row, D> {
  HistoryRepository({
    required GeneratedDatabase db,
    required TableInfo<Tbl, Row> table,
    required Expression<DateTime> Function(Tbl tbl) dateOf,
    required Expression<String> Function(Tbl tbl) idOf,
  })  : _db = db,
        _table = table,
        _dateOf = dateOf,
        _idOf = idOf;

  final GeneratedDatabase _db;
  final TableInfo<Tbl, Row> _table;
  final Expression<DateTime> Function(Tbl tbl) _dateOf;
  final Expression<String> Function(Tbl tbl) _idOf;

  /// Builds a lightweight entry from a row WITHOUT decoding the payload (F23).
  HistoryEntry<D> entryFromRow(Row row);

  /// Newest-first, capped at [kHistoryLimit] (F23).
  Stream<List<HistoryEntry<D>>> watchAll() {
    final query = _db.select(_table)
      ..orderBy([(t) => OrderingTerm.desc(_dateOf(t))])
      ..limit(kHistoryLimit);
    // Read-tolerance (F16): building an entry only touches columns and won't
    // throw on a corrupt payload, but the guard is kept so a malformed row can
    // never error the whole stream. Payload corruption surfaces later, per-row.
    return query.watch().map(
          (rows) => rows
              .map((r) {
                try {
                  return entryFromRow(r);
                } catch (e, st) {
                  logError(e, st);
                  return null;
                }
              })
              .whereType<HistoryEntry<D>>()
              .toList(),
        );
  }

  Future<void> delete(String id) async {
    await (_db.delete(_table)..where((t) => _idOf(t).equals(id))).go();
  }

  Future<void> clear() async {
    await _db.delete(_table).go();
  }
}
