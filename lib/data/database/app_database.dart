// TableMigration is drift's supported mechanism for constraint-changing
// migrations; it is annotated experimental upstream but is the intended API.
// ignore_for_file: experimental_member_use
import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tables/favorites_table.dart';
import 'tables/links_table.dart';
import 'tables/map_pins_table.dart';
import 'tables/maps_tables.dart';
import 'tables/notes_table.dart';
import 'tables/scan_history_table.dart';
import 'tables/ships_table.dart';
import 'tables/tags_table.dart';

part 'app_database.g.dart';

/// Name of the FTS5 virtual table backing zone search. Declared via a raw
/// `CREATE VIRTUAL TABLE` (drift has no first-class FTS5 table type), so it is
/// NOT listed in [DriftDatabase.tables]; queries go through [customStatement] /
/// [customSelect]. `unicode61 remove_diacritics 2` fixes the ASCII-only limit
/// of the legacy KB index (AUDIT-V2 §4.7).
const String kMapZoneFtsTable = 'map_zone_fts';

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
  Favorites,
  JobStatus,
  MapPacks,
  MapPackFiles,
  MapPins,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  AppDatabase.forTesting(super.e);

  // v2 (F44/F46): UNIQUE(tags.name) + ON DELETE CASCADE foreign keys on the
  // three join tables, with PRAGMA foreign_keys enabled.
  // v3 (P3/22): Favorites + JobStatus tables for star/pin/bookmark and job
  // progress tracking.
  // v4 (maps M0): MapPacks + MapPackFiles (blob-store index) + the map_zone_fts
  // FTS5 virtual table for zone search.
  // v5 (Phase E §6.1): MapPins (personal per-zone pins/notes).
  @override
  int get schemaVersion => 5;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
          // createAll() builds the registered relational tables; the FTS5
          // virtual table is raw SQL and must be created explicitly.
          await _createMapZoneFts();
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await _migrateToV2(m);
          }
          if (from < 3) {
            await _migrateToV3(m);
          }
          if (from < 4) {
            await _migrateToV4(m);
          }
          if (from < 5) {
            await _migrateToV5(m);
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

  /// v2 -> v3 migration (P3/22). Purely additive: create the two new tables
  /// backing favorites and job progress tracking. No existing data is touched.
  Future<void> _migrateToV3(Migrator m) async {
    await m.createTable(favorites);
    await m.createTable(jobStatus);
  }

  /// v3 -> v4 migration (maps M0). Purely additive: the blob-store index tables
  /// plus the FTS5 zone-search virtual table. No existing data is touched.
  Future<void> _migrateToV4(Migrator m) async {
    await m.createTable(mapPacks);
    await m.createTable(mapPackFiles);
    await _createMapZoneFts();
  }

  /// v4 -> v5 migration (Phase E §6.1). Purely additive: create the MapPins
  /// table backing personal per-zone notes. No existing data is touched.
  Future<void> _migrateToV5(Migrator m) async {
    await m.createTable(mapPins);
  }

  /// Creates the [kMapZoneFtsTable] FTS5 virtual table. Idempotent via
  /// `IF NOT EXISTS` so a fresh onCreate and an onUpgrade both land safely.
  /// `zone_id`/`map_id` are UNINDEXED (stored, not tokenized) so a match can be
  /// mapped straight back to a zone without a join.
  Future<void> _createMapZoneFts() async {
    await customStatement(
      'CREATE VIRTUAL TABLE IF NOT EXISTS $kMapZoneFtsTable USING fts5('
      'zone_id UNINDEXED, '
      'map_id UNINDEXED, '
      'name, '
      'fields_text, '
      "tokenize = 'unicode61 remove_diacritics 2');",
    );
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
    return driftDatabase(
      name: 'underdeck',
      web: DriftWebOptions(
        sqlite3Wasm: Uri.parse('sqlite3.wasm'),
        driftWorker: Uri.parse('drift_worker.js'),
      ),
    );
  }
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
