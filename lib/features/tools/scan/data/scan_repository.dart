import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../../history/history_repository.dart';
import '../domain/scan_models.dart';

/// A scan history list entry; its payload decodes lazily to the planet
/// snapshots (F23).
typedef ScanEntry = HistoryEntry<List<PlanetPosition>>;

class ScanRepository
    extends HistoryRepository<$ScanHistoryTable, ScanHistoryData,
        List<PlanetPosition>> {
  ScanRepository(this._db)
      : super(
          db: _db,
          table: _db.scanHistory,
          dateOf: (t) => t.date,
          idOf: (t) => t.id,
        );

  final AppDatabase _db;
  static const _uuid = Uuid();

  @override
  ScanEntry entryFromRow(ScanHistoryData row) => HistoryEntry(
        id: row.id,
        date: row.date,
        mode: row.mode,
        errored: row.errored,
        payloadJson: row.payloadJson,
        decode: (j) => (j['snapshots'] as List<dynamic>? ?? const [])
            .map((e) => PlanetPosition.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Future<void> save({
    required ScanMode mode,
    required List<PlanetPosition> snapshots,
    required bool hadErrors,
  }) async {
    final payload = jsonEncode({
      'snapshots': snapshots.map((s) => s.toJson()).toList(),
    });
    await _db.into(_db.scanHistory).insert(
          ScanHistoryCompanion.insert(
            id: _uuid.v4(),
            date: DateTime.now(),
            mode: mode.id,
            payloadJson: payload,
            errored: Value(hadErrors),
          ),
        );
  }
}

final scanRepositoryProvider = Provider<ScanRepository>((ref) {
  return ScanRepository(ref.watch(appDatabaseProvider));
});

final scanHistoryProvider =
    StreamProvider.autoDispose<List<ScanEntry>>((ref) {
  return ref.watch(scanRepositoryProvider).watchAll();
});
