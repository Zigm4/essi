import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:underdeck_app/data/database/app_database.dart';

/// v1-shaped schema (schemaVersion 1): no UNIQUE on tags.name and no foreign
/// keys on the join tables. Only the tables the v1->v2 migration touches (plus
/// their parents) are created.
const _v1Ddl = <String>[
  "CREATE TABLE notes (id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', "
      "body TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, "
      'updated_at INTEGER NOT NULL, PRIMARY KEY (id));',
  "CREATE TABLE links (id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', "
      "url TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', "
      'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, '
      'PRIMARY KEY (id));',
  "CREATE TABLE ships (id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', "
      'model_key TEXT, custom_model_label TEXT, '
      'registered INTEGER NOT NULL DEFAULT 0, location_key TEXT, '
      'custom_location TEXT, location_zone INTEGER, location_sector TEXT, '
      'location_sl INTEGER, hull INTEGER, pilot_name TEXT, gunner_name TEXT, '
      'cartographer_name TEXT, prospector_name TEXT, signaller_name TEXT, '
      'technician_name TEXT, sentry_name TEXT, fabricator_name TEXT, '
      'medic_name TEXT, quartermaster_name TEXT, chef_name TEXT, '
      "alchemist_name TEXT, note TEXT NOT NULL DEFAULT '', "
      'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, '
      'PRIMARY KEY (id));',
  'CREATE TABLE tags (id TEXT NOT NULL, display_name TEXT NOT NULL, '
      'name TEXT NOT NULL, color_hex TEXT, PRIMARY KEY (id));',
  'CREATE TABLE note_tags (note_id TEXT NOT NULL, tag_id TEXT NOT NULL, '
      'PRIMARY KEY (note_id, tag_id));',
  'CREATE TABLE link_tags (link_id TEXT NOT NULL, tag_id TEXT NOT NULL, '
      'PRIMARY KEY (link_id, tag_id));',
  'CREATE TABLE ship_tags (ship_id TEXT NOT NULL, tag_id TEXT NOT NULL, '
      'PRIMARY KEY (ship_id, tag_id));',
];

/// Builds a raw v1 in-memory database seeded with:
///  - two notes,
///  - a DUPLICATE tag name ("mining" under two different ids),
///  - a distinct "combat" tag,
///  - valid join rows, plus two ORPHAN join rows (missing note / missing tag).
Database _seedV1() {
  final raw = sqlite3.openInMemory();
  for (final stmt in _v1Ddl) {
    raw.execute(stmt);
  }
  const ts = 1704067200; // 2024-01-01T00:00:00Z, stored as unix seconds.

  raw.execute(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES '
    "('note-1', 'Mining spot', '', $ts, $ts), "
    "('note-2', 'Combat log', '', $ts, $ts);",
  );
  raw.execute(
    'INSERT INTO tags (id, display_name, name, color_hex) VALUES '
    "('t-mining-A', 'Mining', 'mining', NULL), "
    "('t-mining-B', 'mining', 'mining', NULL), "
    "('t-combat', 'Combat', 'combat', NULL);",
  );
  raw.execute(
    'INSERT INTO note_tags (note_id, tag_id) VALUES '
    "('note-1', 't-mining-A'), " // note-1 -> mining (canonical side)
    "('note-2', 't-mining-B'), " // note-2 -> duplicate mining (repointed)
    "('note-2', 't-combat'), " // note-2 -> combat
    "('note-missing', 't-combat'), " // ORPHAN: parent note gone
    "('note-1', 't-ghost');", // ORPHAN: referenced tag gone
  );
  raw.userVersion = 1;
  return raw;
}

void main() {
  test('v1 -> v2 migration dedupes tags, drops orphans, preserves data', () async {
    final raw = _seedV1();
    final db = AppDatabase.forTesting(
      NativeDatabase.opened(raw, closeUnderlyingOnClose: false),
    );

    // Any query opens the database, running onUpgrade (1->2) and beforeOpen
    // (which enables foreign keys and, in debug, runs foreign_key_check).
    final tagsAfter = await db.select(db.tags).get();

    // Duplicate "mining" tags collapsed into one; "combat" survives.
    final miningTags = tagsAfter.where((t) => t.name == 'mining').toList();
    expect(miningTags, hasLength(1),
        reason: 'duplicate tag name must be deduped to a single row');
    final miningId = miningTags.single.id;
    expect(tagsAfter.map((t) => t.name), containsAll(<String>['mining', 'combat']));
    expect(tagsAfter, hasLength(2));

    // Both notes preserved.
    final notes = await db.select(db.notes).get();
    expect(notes.map((n) => n.id), containsAll(<String>['note-1', 'note-2']));

    // Join rows: note-1 -> {mining}; note-2 -> {mining (repointed), combat}.
    final noteTags = await db.select(db.noteTags).get();
    final combatId = tagsAfter.firstWhere((t) => t.name == 'combat').id;
    expect(
      noteTags
          .where((nt) => nt.noteId == 'note-1')
          .map((nt) => nt.tagId)
          .toSet(),
      {miningId},
    );
    expect(
      noteTags
          .where((nt) => nt.noteId == 'note-2')
          .map((nt) => nt.tagId)
          .toSet(),
      {miningId, combatId},
      reason: 'the duplicate tag reference must be repointed onto the canonical',
    );

    // Orphan join rows removed.
    expect(noteTags.any((nt) => nt.noteId == 'note-missing'), isFalse);
    expect(noteTags.any((nt) => nt.tagId == 't-ghost'), isFalse);
    // No join row references a tag that no longer exists.
    final tagIds = tagsAfter.map((t) => t.id).toSet();
    expect(noteTags.every((nt) => tagIds.contains(nt.tagId)), isTrue);

    // UNIQUE(name) is now enforced.
    await expectLater(
      db.into(db.tags).insert(TagsCompanion.insert(
            id: 't-mining-dup',
            displayName: 'Mining',
            name: 'mining',
          )),
      throwsA(predicate(
        (e) => e.toString().toLowerCase().contains('unique'),
        'a UNIQUE constraint violation',
      )),
    );

    // ON DELETE CASCADE removes join rows when the parent note is deleted.
    await (db.delete(db.notes)..where((t) => t.id.equals('note-2'))).go();
    final afterNoteDelete = await db.select(db.noteTags).get();
    expect(afterNoteDelete.any((nt) => nt.noteId == 'note-2'), isFalse,
        reason: 'deleting a note must cascade to its note_tags rows');

    // ON DELETE CASCADE removes join rows when the parent tag is deleted.
    await (db.delete(db.tags)..where((t) => t.id.equals(miningId))).go();
    final afterTagDelete = await db.select(db.noteTags).get();
    expect(afterTagDelete.any((nt) => nt.tagId == miningId), isFalse,
        reason: 'deleting a tag must cascade to join rows referencing it');

    await db.close();
    raw.dispose();
  });
}
