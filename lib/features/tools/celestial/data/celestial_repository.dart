import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../../history/history_repository.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

/// Lazily-decoded payload of a discovery history entry (F23). The [CelestialKind]
/// lives in the row's `mode` column, so it stays available without decoding.
class DiscoveryDetail {
  const DiscoveryDetail({
    required this.startDate,
    required this.endDate,
    required this.results,
  });

  final DateTime startDate;
  final DateTime endDate;
  final List<DiscoveredObject> results;

  factory DiscoveryDetail.fromJson(Map<String, dynamic> j) => DiscoveryDetail(
        startDate: DateTime.parse(j['startDate'] as String),
        endDate: DateTime.parse(j['endDate'] as String),
        results: ((j['results'] as List<dynamic>?) ?? const [])
            .map((e) => DiscoveredObject.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

typedef DiscoveryEntry = HistoryEntry<DiscoveryDetail>;

class CelestialRepository
    extends HistoryRepository<$DiscoveryHistoryTable, DiscoveryHistoryData,
        DiscoveryDetail> {
  CelestialRepository(this._db)
      : super(
          db: _db,
          table: _db.discoveryHistory,
          dateOf: (t) => t.date,
          idOf: (t) => t.id,
        );

  final AppDatabase _db;
  static const _uuid = Uuid();

  @override
  DiscoveryEntry entryFromRow(DiscoveryHistoryData row) => HistoryEntry(
        id: row.id,
        date: row.date,
        mode: row.mode,
        errored: row.errored,
        payloadJson: row.payloadJson,
        decode: DiscoveryDetail.fromJson,
      );

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
}

final celestialRepositoryProvider = Provider<CelestialRepository>((ref) {
  return CelestialRepository(ref.watch(appDatabaseProvider));
});

final discoveryHistoryProvider =
    StreamProvider.autoDispose<List<DiscoveryEntry>>((ref) {
  return ref.watch(celestialRepositoryProvider).watchAll();
});
