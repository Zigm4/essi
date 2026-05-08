import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../domain/scan_models.dart';

class ScanHistoryRecord {
  final String id;
  final DateTime date;
  final ScanMode mode;
  final List<PlanetPosition> snapshots;
  final bool hadErrors;

  const ScanHistoryRecord({
    required this.id,
    required this.date,
    required this.mode,
    required this.snapshots,
    required this.hadErrors,
  });

  static ScanHistoryRecord fromRow(ScanHistoryData row) {
    final decoded = jsonDecode(row.payloadJson) as Map<String, dynamic>;
    final list = (decoded['snapshots'] as List<dynamic>? ?? [])
        .map((j) => PlanetPosition.fromJson(j as Map<String, dynamic>))
        .toList();
    return ScanHistoryRecord(
      id: row.id,
      date: row.date,
      mode: ScanModeX.fromId(row.mode),
      snapshots: list,
      hadErrors: row.errored,
    );
  }
}

class ScanRepository {
  ScanRepository(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();

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

  Stream<List<ScanHistoryRecord>> watchAll() {
    final query = _db.select(_db.scanHistory)
      ..orderBy([(t) => OrderingTerm.desc(t.date)]);
    return query.watch().map(
      (rows) => rows.map(ScanHistoryRecord.fromRow).toList(),
    );
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.scanHistory)..where((t) => t.id.equals(id))).go();
  }

  Future<void> clear() async {
    await _db.delete(_db.scanHistory).go();
  }
}

final scanRepositoryProvider = Provider<ScanRepository>((ref) {
  return ScanRepository(ref.watch(appDatabaseProvider));
});

final scanHistoryProvider = StreamProvider<List<ScanHistoryRecord>>((ref) {
  return ref.watch(scanRepositoryProvider).watchAll();
});
