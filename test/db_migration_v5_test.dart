import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:underdeck_app/data/database/app_database.dart';

/// v4-shaped schema (schemaVersion 4): the tables needed to prove prior data
/// survives the v5 migration — notes + favorites + the v4 maps index tables —
/// but BEFORE the v5 MapPins table.
const _v4Ddl = <String>[
  "CREATE TABLE notes (id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', "
      "body TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, "
      'updated_at INTEGER NOT NULL, PRIMARY KEY (id));',
  'CREATE TABLE favorites (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, '
      'created_at INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id));',
  'CREATE TABLE map_packs (content_version TEXT NOT NULL, tag TEXT NOT NULL, '
      'manifest_sha256 TEXT NOT NULL, installed_at INTEGER NOT NULL, '
      'state TEXT NOT NULL, PRIMARY KEY (content_version));',
  'CREATE TABLE map_pack_files (content_version TEXT NOT NULL, '
      'logical_path TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, '
      'kind TEXT, PRIMARY KEY (content_version, logical_path));',
];

/// Builds a raw v4 in-memory database seeded with prior data so the v5
/// migration can be asserted to preserve it.
Database _seedV4() {
  final raw = sqlite3.openInMemory();
  for (final stmt in _v4Ddl) {
    raw.execute(stmt);
  }
  // The FTS5 zone-search virtual table exists on a real v4 db; recreate it so
  // beforeOpen's debug schema validation stays happy.
  raw.execute(
    'CREATE VIRTUAL TABLE IF NOT EXISTS $kMapZoneFtsTable USING fts5('
    'zone_id UNINDEXED, map_id UNINDEXED, name, fields_text, '
    "tokenize = 'unicode61 remove_diacritics 2');",
  );
  const ts = 1704067200; // 2024-01-01T00:00:00Z, unix seconds.
  raw.execute(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES '
    "('note-1', 'Mining spot', 'body', $ts, $ts);",
  );
  raw.execute(
    'INSERT INTO favorites (entity_type, entity_id, created_at) VALUES '
    "('job', '42', $ts);",
  );
  raw.userVersion = 4;
  return raw;
}

void main() {
  test('v4 -> v5 migration adds MapPins, preserves prior data', () async {
    final raw = _seedV4();
    final db = AppDatabase.forTesting(
      NativeDatabase.opened(raw, closeUnderlyingOnClose: false),
    );

    // Any query opens the database, running onUpgrade (4->5) which creates the
    // MapPins table, then beforeOpen.
    final notes = await db.select(db.notes).get();
    expect(notes.map((n) => n.id), contains('note-1'),
        reason: 'prior data must survive the additive v5 migration');
    expect(notes.single.title, 'Mining spot');

    final favs = await db.select(db.favorites).get();
    expect(favs.single.entityId, '42');

    // New MapPins table exists and is writable.
    await db.into(db.mapPins).insert(
          MapPinsCompanion.insert(
            id: 'pin-1',
            mapId: 'hideous-dungeon',
            zoneId: 'z-entry',
            note: const Value('watch the trapped floor'),
            createdAt: DateTime.utc(2026, 1, 1),
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        );
    final pins = await db.select(db.mapPins).get();
    expect(pins, hasLength(1));
    expect(pins.single.note, 'watch the trapped floor');
    expect(pins.single.mapId, 'hideous-dungeon');

    // id is PK: re-inserting the same id collides.
    await expectLater(
      db.into(db.mapPins).insert(
            MapPinsCompanion.insert(
              id: 'pin-1',
              mapId: 'other',
              zoneId: 'z-2',
              createdAt: DateTime.utc(2026, 2, 1),
              updatedAt: DateTime.utc(2026, 2, 1),
            ),
          ),
      throwsA(anything),
    );

    // Schema version is now 5.
    expect(db.schemaVersion, 5);

    await db.close();
    raw.dispose();
  });

  test('fresh onCreate builds the MapPins table too', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());

    await db.into(db.mapPins).insert(
          MapPinsCompanion.insert(
            id: 'p',
            mapId: 'm',
            zoneId: 'z',
            createdAt: DateTime.utc(2026, 1, 1),
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        );
    final pins = await db.select(db.mapPins).get();
    expect(pins.single.id, 'p');
    expect(pins.single.note, '', reason: 'note defaults to empty string');

    await db.close();
  });
}
