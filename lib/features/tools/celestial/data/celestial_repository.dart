import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

class DiscoveryHistoryRecord {
  final String id;
  final DateTime date;
  final CelestialKind kind;
  final DateTime startDate;
  final DateTime endDate;
  final List<DiscoveredObject> results;

  const DiscoveryHistoryRecord({
    required this.id,
    required this.date,
    required this.kind,
    required this.startDate,
    required this.endDate,
    required this.results,
  });

  static DiscoveryHistoryRecord fromRow(DiscoveryHistoryData row) {
    final j = jsonDecode(row.payloadJson) as Map<String, dynamic>;
    return DiscoveryHistoryRecord(
      id: row.id,
      date: row.date,
      kind: CelestialKindX.fromId(row.mode),
      startDate: DateTime.parse(j['startDate'] as String),
      endDate: DateTime.parse(j['endDate'] as String),
      results: ((j['results'] as List<dynamic>?) ?? const [])
          .map((e) => DiscoveredObject.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class CelestialRepository {
  CelestialRepository(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();

  Future<void> save({
    required CelestialKind kind,
    required DateTime startDate,
    required DateTime endDate,
    required List<DiscoveredObject> results,
  }) async {
    final payload = jsonEncode({
      'startDate': startDate.toUtc().toIso8601String(),
      'endDate': endDate.toUtc().toIso8601String(),
      'results': results.map((r) => r.toJson()).toList(),
    });
    await _db.into(_db.discoveryHistory).insert(
      DiscoveryHistoryCompanion.insert(
        id: _uuid.v4(),
        date: DateTime.now(),
        mode: kind.id,
        payloadJson: payload,
      ),
    );
  }

  Stream<List<DiscoveryHistoryRecord>> watchAll() {
    final q = _db.select(_db.discoveryHistory)
      ..orderBy([(t) => OrderingTerm.desc(t.date)]);
    return q.watch().map(
      (rows) => rows.map(DiscoveryHistoryRecord.fromRow).toList(),
    );
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.discoveryHistory)..where((t) => t.id.equals(id))).go();
  }

  Future<void> clear() async {
    await _db.delete(_db.discoveryHistory).go();
  }
}

final celestialRepositoryProvider = Provider<CelestialRepository>((ref) {
  return CelestialRepository(ref.watch(appDatabaseProvider));
});

final discoveryHistoryProvider =
    StreamProvider<List<DiscoveryHistoryRecord>>((ref) {
  return ref.watch(celestialRepositoryProvider).watchAll();
});
