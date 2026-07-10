import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/captures/data/captures_repository.dart';

/// R9a: pruneOrphanTags now deletes every tag referenced by none of the three
/// join tables in a single NOT EXISTS DELETE. These tests pin the behavior:
/// tags still referenced anywhere survive, tags referenced nowhere are pruned.
void main() {
  late AppDatabase db;
  late CapturesRepository repo;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repo = CapturesRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Future<Set<String>> tagNames() async {
    final rows = await db.select(db.tags).get();
    return rows.map((t) => t.name).toSet();
  }

  test('a tag referenced by a note is kept, an orphan tag is pruned', () async {
    // "keep" is attached to a note; "orphan" is attached to nothing.
    await repo.saveNote(
      title: 'Kept',
      body: '',
      tagDisplayNames: const ['Keep'],
    );
    await db.into(db.tags).insert(
          TagsCompanion.insert(
            id: 'orphan-id',
            displayName: 'Orphan',
            name: 'orphan',
          ),
        );

    await repo.pruneOrphanTags();

    final names = await tagNames();
    expect(names, contains('keep'));
    expect(names, isNot(contains('orphan')));
  });

  test('a tag referenced only by a link is kept', () async {
    await repo.saveLink(
      title: 'Linked',
      url: 'https://example.com',
      note: '',
      tagDisplayNames: const ['LinkTag'],
    );
    await db.into(db.tags).insert(
          TagsCompanion.insert(
            id: 'lonely-id',
            displayName: 'Lonely',
            name: 'lonely',
          ),
        );

    await repo.pruneOrphanTags();

    final names = await tagNames();
    expect(names, contains('linktag'));
    expect(names, isNot(contains('lonely')));
  });
}
