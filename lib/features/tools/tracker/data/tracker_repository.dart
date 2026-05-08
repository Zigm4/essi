import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';
import '../../celestial/domain/celestial_kind.dart';
import '../domain/tracker_models.dart';

class TrackerHistoryRecord {
  final String id;
  final DateTime date;
  final TrackerResult result;
  final bool errored;

  const TrackerHistoryRecord({
    required this.id,
    required this.date,
    required this.result,
    required this.errored,
  });

  static TrackerHistoryRecord fromRow(TrackerHistoryData row) {
    final j = jsonDecode(row.payloadJson) as Map<String, dynamic>;
    return TrackerHistoryRecord(
      id: row.id,
      date: row.date,
      result: TrackerResult.fromJson(j),
      errored: row.errored,
    );
  }
}

class TrackerRepository {
  TrackerRepository(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();

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

  Stream<List<TrackerHistoryRecord>> watchAll() {
    final q = _db.select(_db.trackerHistory)
      ..orderBy([(t) => OrderingTerm.desc(t.date)]);
    return q.watch().map((rows) => rows.map(TrackerHistoryRecord.fromRow).toList());
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.trackerHistory)..where((t) => t.id.equals(id))).go();
  }

  Future<void> clear() async {
    await _db.delete(_db.trackerHistory).go();
  }
}

final trackerRepositoryProvider = Provider<TrackerRepository>((ref) {
  return TrackerRepository(ref.watch(appDatabaseProvider));
});

final trackerHistoryProvider =
    StreamProvider<List<TrackerHistoryRecord>>((ref) {
  return ref.watch(trackerRepositoryProvider).watchAll();
});

