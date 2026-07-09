// TableMigration is drift's supported mechanism for constraint-changing
// migrations; it is annotated experimental upstream but is the intended API.
// ignore_for_file: experimental_member_use
import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter/foundation.dart';
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

  // v2 (F44/F46): UNIQUE(tags.name) + ON DELETE CASCADE foreign keys on the
  // three join tables, with PRAGMA foreign_keys enabled.
  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await _migrateToV2(m);
          }
        },
        beforeOpen: (details) async {
          // Enforce foreign keys on every connection (not persisted by SQLite).
          await customStatement('PRAGMA foreign_keys = ON');
          if (kDebugMode) {
            await _validateDatabaseSchema();
          }
        },
      );

  /// v1 -> v2 migration. Before adding the UNIQUE + FK constraints we clean up
  /// any data that would make the table rebuild fail: duplicate tag names are
  /// deduped (join rows repointed onto a single canonical tag) and orphan join
  /// rows (referencing a missing parent) are deleted. The tables are then
  /// rebuilt via [TableMigration], which copies existing rows into the new
  /// schema without data loss.
  Future<void> _migrateToV2(Migrator m) async {
    // 1. Dedupe tags that share the same lowercase name.
    final allTags = await select(tags).get();
    final canonicalByKey = <String, String>{};
    final remap = <String, String>{}; // duplicateTagId -> canonicalTagId
    for (final t in allTags) {
      final key = t.name.toLowerCase();
      final canonical = canonicalByKey.putIfAbsent(key, () => t.id);
      if (canonical != t.id) remap[t.id] = canonical;
    }

    if (remap.isNotEmpty) {
      // Repoint join rows off the duplicate tag ids onto their canonical id.
      // A repoint that would collide with an existing (parent, canonical) row
      // is dropped as redundant (insertOrIgnore + delete of the old row).
      await _repointTagJoins(
        select(noteTags).get(),
        remap,
        (row) => (delete(noteTags)
              ..where((t) =>
                  t.noteId.equals(row.noteId) & t.tagId.equals(row.tagId)))
            .go(),
        (row, canonical) => into(noteTags).insert(
          NoteTagsCompanion.insert(noteId: row.noteId, tagId: canonical),
          mode: InsertMode.insertOrIgnore,
        ),
        (row) => row.tagId,
      );
      await _repointTagJoins(
        select(linkTags).get(),
        remap,
        (row) => (delete(linkTags)
              ..where((t) =>
                  t.linkId.equals(row.linkId) & t.tagId.equals(row.tagId)))
            .go(),
        (row, canonical) => into(linkTags).insert(
          LinkTagsCompanion.insert(linkId: row.linkId, tagId: canonical),
          mode: InsertMode.insertOrIgnore,
        ),
        (row) => row.tagId,
      );
      await _repointTagJoins(
        select(shipTags).get(),
        remap,
        (row) => (delete(shipTags)
              ..where((t) =>
                  t.shipId.equals(row.shipId) & t.tagId.equals(row.tagId)))
            .go(),
        (row, canonical) => into(shipTags).insert(
          ShipTagsCompanion.insert(shipId: row.shipId, tagId: canonical),
          mode: InsertMode.insertOrIgnore,
        ),
        (row) => row.tagId,
      );
      // Remove the now-unreferenced duplicate tags.
      await (delete(tags)..where((t) => t.id.isIn(remap.keys.toList()))).go();
    }

    // 2. Delete orphan join rows (parent note/link/ship or tag missing) so the
    //    FK-enforced rebuild can't fail the foreign_key_check.
    final noteIds = (await select(notes).get()).map((n) => n.id).toSet();
    final linkIds = (await select(links).get()).map((l) => l.id).toSet();
    final shipIds = (await select(ships).get()).map((s) => s.id).toSet();
    final tagIds = (await select(tags).get()).map((t) => t.id).toSet();

    for (final r in await select(noteTags).get()) {
      if (!noteIds.contains(r.noteId) || !tagIds.contains(r.tagId)) {
        await (delete(noteTags)
              ..where(
                  (t) => t.noteId.equals(r.noteId) & t.tagId.equals(r.tagId)))
            .go();
      }
    }
    for (final r in await select(linkTags).get()) {
      if (!linkIds.contains(r.linkId) || !tagIds.contains(r.tagId)) {
        await (delete(linkTags)
              ..where(
                  (t) => t.linkId.equals(r.linkId) & t.tagId.equals(r.tagId)))
            .go();
      }
    }
    for (final r in await select(shipTags).get()) {
      if (!shipIds.contains(r.shipId) || !tagIds.contains(r.tagId)) {
        await (delete(shipTags)
              ..where(
                  (t) => t.shipId.equals(r.shipId) & t.tagId.equals(r.tagId)))
            .go();
      }
    }

    // 3. Rebuild the tables so the UNIQUE + FK constraints take effect. Each
    //    alterTable toggles PRAGMA foreign_keys internally while it runs.
    await m.alterTable(TableMigration(tags));
    await m.alterTable(TableMigration(noteTags));
    await m.alterTable(TableMigration(linkTags));
    await m.alterTable(TableMigration(shipTags));
  }

  /// Repoints join rows that reference a duplicate tag id onto its canonical
  /// id. [rowsFuture] yields the join rows, [tagOf] reads a row's tag id,
  /// [deleteRow] removes the old row and [insertCanonical] re-inserts it with
  /// the canonical tag id (ignoring collisions).
  Future<void> _repointTagJoins<R>(
    Future<List<R>> rowsFuture,
    Map<String, String> remap,
    Future<void> Function(R row) deleteRow,
    Future<void> Function(R row, String canonical) insertCanonical,
    String Function(R row) tagOf,
  ) async {
    for (final row in await rowsFuture) {
      final canonical = remap[tagOf(row)];
      if (canonical == null) continue;
      await deleteRow(row);
      await insertCanonical(row, canonical);
    }
  }

  /// Debug-only integrity assertion: fails loudly if any foreign key is left
  /// dangling after migrations.
  Future<void> _validateDatabaseSchema() async {
    final violations = await customSelect('PRAGMA foreign_key_check').get();
    assert(
      violations.isEmpty,
      'Foreign key violations detected after opening the database: '
      '${violations.map((r) => r.data).toList()}',
    );
  }

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'underdeck');
  }
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
