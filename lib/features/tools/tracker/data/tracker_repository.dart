import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../../celestial/domain/celestial_kind.dart';
import '../../history/history_repository.dart';
import '../domain/tracker_models.dart';

/// A tracker history list entry; its payload decodes lazily to the full
/// [TrackerResult] (F23).
typedef TrackerEntry = HistoryEntry<TrackerResult>;

class TrackerRepository
    extends HistoryRepository<$TrackerHistoryTable, TrackerHistoryData,
        TrackerResult> {
  TrackerRepository(this._db)
      : super(
          db: _db,
          table: _db.trackerHistory,
          dateOf: (t) => t.date,
          idOf: (t) => t.id,
        );

  final AppDatabase _db;
  static const _uuid = Uuid();

  @override
  TrackerEntry entryFromRow(TrackerHistoryData row) => HistoryEntry(
        id: row.id,
        date: row.date,
        mode: row.mode,
        errored: row.errored,
        payloadJson: row.payloadJson,
        decode: TrackerResult.fromJson,
      );

  Future<void> save(TrackerResult result) async {
    await _db.into(_db.trackerHistory).insert(
          TrackerHistoryCompanion.insert(
            id: _uuid.v4(),
            date: DateTime.now(),
            mode: result.kind.id,
            payloadJson: jsonEncode(result.toJson()),
          ),
        );
  }
}

final trackerRepositoryProvider = Provider<TrackerRepository>((ref) {
  return TrackerRepository(ref.watch(appDatabaseProvider));
});

final trackerHistoryProvider =
    StreamProvider.autoDispose<List<TrackerEntry>>((ref) {
  return ref.watch(trackerRepositoryProvider).watchAll();
});
