import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:underdeck_app/data/database/app_database.dart';

/// v2-shaped schema (schemaVersion 2): the state AFTER the v1->v2 migration —
/// UNIQUE(tags.name) + FK'd join tables — but BEFORE the v3 favorites/jobStatus
/// tables were introduced. Only the tables needed to prove prior data survives
/// are created here.
const _v2Ddl = <String>[
  "CREATE TABLE notes (id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', "
      "body TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, "
      'updated_at INTEGER NOT NULL, PRIMARY KEY (id));',
  'CREATE TABLE tags (id TEXT NOT NULL, display_name TEXT NOT NULL, '
      'name TEXT NOT NULL UNIQUE, color_hex TEXT, PRIMARY KEY (id));',
  'CREATE TABLE note_tags (note_id TEXT NOT NULL, tag_id TEXT NOT NULL, '
      'PRIMARY KEY (note_id, tag_id), '
      'FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE, '
      'FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE);',
];

/// Builds a raw v2 in-memory database seeded with a note, a tag and a join row
/// so the v3 migration can be asserted to preserve prior data.
Database _seedV2() {
  final raw = sqlite3.openInMemory();
  for (final stmt in _v2Ddl) {
    raw.execute(stmt);
  }
  const ts = 1704067200; // 2024-01-01T00:00:00Z, unix seconds.
  raw.execute(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES '
    "('note-1', 'Mining spot', 'body', $ts, $ts);",
  );
  raw.execute(
    'INSERT INTO tags (id, display_name, name, color_hex) VALUES '
    "('t-mining', 'Mining', 'mining', NULL);",
  );
  raw.execute(
    "INSERT INTO note_tags (note_id, tag_id) VALUES ('note-1', 't-mining');",
  );
  raw.userVersion = 2;
  return raw;
}

void main() {
  test('v2 -> v3 migration creates favorites + jobStatus, preserves data',
      () async {
    final raw = _seedV2();
    final db = AppDatabase.forTesting(
      NativeDatabase.opened(raw, closeUnderlyingOnClose: false),
    );

    // Any query opens the database, running onUpgrade (2->3) which creates the
    // two new tables, and beforeOpen (enables FKs + debug foreign_key_check).
    final notes = await db.select(db.notes).get();
    expect(notes.map((n) => n.id), contains('note-1'),
        reason: 'prior data must survive the additive v3 migration');
    expect(notes.single.title, 'Mining spot');

    // Join row + tag survive.
    final noteTags = await db.select(db.noteTags).get();
    expect(noteTags.single.tagId, 't-mining');

    // New favorites table exists and is writable.
    await db.into(db.favorites).insert(
          FavoritesCompanion.insert(
            entityType: 'job',
            entityId: '42',
            createdAt: DateTime.utc(2026, 1, 1),
          ),
        );
    final favs = await db.select(db.favorites).get();
    expect(favs, hasLength(1));
    expect(favs.single.entityType, 'job');
    expect(favs.single.entityId, '42');

    // Composite PK: re-inserting the same (type,id) collides.
    await expectLater(
      db.into(db.favorites).insert(
            FavoritesCompanion.insert(
              entityType: 'job',
              entityId: '42',
              createdAt: DateTime.utc(2026, 2, 1),
            ),
          ),
      throwsA(anything),
    );

    // New jobStatus table exists and is writable.
    await db.into(db.jobStatus).insert(
          JobStatusCompanion.insert(
            jobId: '42',
            status: 'in_progress',
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        );
    final statuses = await db.select(db.jobStatus).get();
    expect(statuses.single.status, 'in_progress');

    // jobId is PK: an upsert replaces rather than duplicates.
    await db.into(db.jobStatus).insertOnConflictUpdate(
          JobStatusCompanion.insert(
            jobId: '42',
            status: 'done',
            updatedAt: DateTime.utc(2026, 3, 1),
          ),
        );
    final after = await db.select(db.jobStatus).get();
    expect(after, hasLength(1));
    expect(after.single.status, 'done');

    // The app's current schema constant (opening a v2 db upgrades all the way
    // to it — 5 since the Phase E map-pins table landed). This suite still
    // proves the v3 favorites/jobStatus tables are created along the way.
    expect(db.schemaVersion, 5);

    await db.close();
    raw.dispose();
  });
}
