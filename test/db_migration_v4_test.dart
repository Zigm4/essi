import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:underdeck_app/data/database/app_database.dart';

/// v3-shaped schema (schemaVersion 3): notes + tags + join, plus the v3
/// favorites/jobStatus tables — but BEFORE the v4 maps index tables and the
/// FTS5 zone-search table. Only the tables needed to prove prior data survives
/// are created here.
const _v3Ddl = <String>[
  "CREATE TABLE notes (id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', "
      "body TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, "
      'updated_at INTEGER NOT NULL, PRIMARY KEY (id));',
  'CREATE TABLE favorites (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, '
      'created_at INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id));',
  'CREATE TABLE job_status (job_id TEXT NOT NULL, status TEXT NOT NULL, '
      'updated_at INTEGER NOT NULL, PRIMARY KEY (job_id));',
];

/// Builds a raw v3 in-memory database seeded with a note and a favorite so the
/// v4 migration can be asserted to preserve prior data.
Database _seedV3() {
  final raw = sqlite3.openInMemory();
  for (final stmt in _v3Ddl) {
    raw.execute(stmt);
  }
  const ts = 1704067200; // 2024-01-01T00:00:00Z, unix seconds.
  raw.execute(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES '
    "('note-1', 'Mining spot', 'body', $ts, $ts);",
  );
  raw.execute(
    'INSERT INTO favorites (entity_type, entity_id, created_at) VALUES '
    "('job', '42', $ts);",
  );
  raw.userVersion = 3;
  return raw;
}

void main() {
  test('v3 -> v4 migration adds maps tables + FTS, preserves prior data',
      () async {
    final raw = _seedV3();
    final db = AppDatabase.forTesting(
      NativeDatabase.opened(raw, closeUnderlyingOnClose: false),
    );

    // Any query opens the database, running onUpgrade (3->4) which creates the
    // two maps tables + the FTS5 virtual table, then beforeOpen.
    final notes = await db.select(db.notes).get();
    expect(notes.map((n) => n.id), contains('note-1'),
        reason: 'prior data must survive the additive v4 migration');
    expect(notes.single.title, 'Mining spot');

    // v3 data survives too.
    final favs = await db.select(db.favorites).get();
    expect(favs.single.entityId, '42');

    // New MapPacks table exists and is writable.
    await db.into(db.mapPacks).insert(
          MapPacksCompanion.insert(
            contentVersion: '1.4.0',
            tag: 'maps-v1.4.0',
            manifestSha256: 'a' * 64,
            installedAt: DateTime.utc(2026, 1, 1),
            state: 'installed',
          ),
        );
    final packs = await db.select(db.mapPacks).get();
    expect(packs, hasLength(1));
    expect(packs.single.tag, 'maps-v1.4.0');

    // contentVersion is PK: re-inserting collides.
    await expectLater(
      db.into(db.mapPacks).insert(
            MapPacksCompanion.insert(
              contentVersion: '1.4.0',
              tag: 'other',
              manifestSha256: 'b' * 64,
              installedAt: DateTime.utc(2026, 2, 1),
              state: 'installed',
            ),
          ),
      throwsA(anything),
    );

    // New MapPackFiles table exists and is writable; composite PK.
    await db.into(db.mapPackFiles).insert(
          MapPackFilesCompanion.insert(
            contentVersion: '1.4.0',
            logicalPath: 'maps/hideous-dungeon/map.json',
            sha256: 'c' * 64,
            bytes: 40210,
            kind: const Value('document'),
          ),
        );
    final files = await db.select(db.mapPackFiles).get();
    expect(files.single.logicalPath, 'maps/hideous-dungeon/map.json');
    expect(files.single.kind, 'document');

    // FTS5 zone-search table: insert + query round-trips, unicode-aware.
    await db.customStatement(
      'INSERT INTO $kMapZoneFtsTable (zone_id, map_id, name, fields_text) '
      "VALUES ('z-entry', 'hideous-dungeon', 'Hall of Chains', "
      "'rusted key single entry point');",
    );
    await db.customStatement(
      'INSERT INTO $kMapZoneFtsTable (zone_id, map_id, name, fields_text) '
      "VALUES ('s-01', 'keth-9', 'Crucible Sector', 'ferrous pact');",
    );

    final hits = await db
        .customSelect(
          'SELECT zone_id, map_id FROM $kMapZoneFtsTable '
          "WHERE $kMapZoneFtsTable MATCH 'chains'",
        )
        .get();
    expect(hits, hasLength(1));
    expect(hits.single.read<String>('zone_id'), 'z-entry');
    expect(hits.single.read<String>('map_id'), 'hideous-dungeon');

    // Diacritics-folding: a query without the accent still matches an accented
    // token (remove_diacritics 2).
    await db.customStatement(
      'INSERT INTO $kMapZoneFtsTable (zone_id, map_id, name, fields_text) '
      "VALUES ('z-cafe', 'm', 'Café Ruins', 'crème brûlée');",
    );
    final folded = await db
        .customSelect(
          'SELECT zone_id FROM $kMapZoneFtsTable '
          "WHERE $kMapZoneFtsTable MATCH 'cafe'",
        )
        .get();
    expect(folded.single.read<String>('zone_id'), 'z-cafe');

    // Schema version reflects the app's current schema (bumped to 5 in Phase E).
    expect(db.schemaVersion, 5);

    await db.close();
    raw.dispose();
  });

  test('fresh onCreate builds the FTS5 table too', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());

    // Force onCreate by touching a v4 table.
    await db.into(db.mapPacks).insert(
          MapPacksCompanion.insert(
            contentVersion: '1.0.0',
            tag: 't',
            manifestSha256: 'd' * 64,
            installedAt: DateTime.utc(2026, 1, 1),
            state: 'installed',
          ),
        );

    // FTS table must exist on a from-scratch database (not just after upgrade).
    await db.customStatement(
      'INSERT INTO $kMapZoneFtsTable (zone_id, map_id, name, fields_text) '
      "VALUES ('z', 'm', 'Alpha', 'beta');",
    );
    final hits = await db
        .customSelect(
          'SELECT zone_id FROM $kMapZoneFtsTable '
          "WHERE $kMapZoneFtsTable MATCH 'alpha'",
        )
        .get();
    expect(hits.single.read<String>('zone_id'), 'z');

    await db.close();
  });
}
