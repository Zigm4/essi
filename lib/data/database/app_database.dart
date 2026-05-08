import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tables/links_table.dart';
import 'tables/notes_table.dart';
import 'tables/scan_history_table.dart';
import 'tables/ships_table.dart';
import 'tables/tags_table.dart';

part 'app_database.g.dart';

@DriftDatabase(tables: [
  Notes,
  Links,
  Tags,
  NoteTags,
  LinkTags,
  ShipTags,
  Ships,
  ScanHistory,
  TrackerHistory,
  DiscoveryHistory,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 1;

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'underdeck');
  }
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
