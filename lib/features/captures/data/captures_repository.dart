import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:rxdart/rxdart.dart';
import 'package:uuid/uuid.dart';

import '../../../data/database/app_database.dart';
import '../domain/captures_models.dart';

class CapturesRepository {
  CapturesRepository(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();

  TagModel _tagFromRow(Tag row) => TagModel(
    id: row.id,
    displayName: row.displayName,
    name: row.name,
    colorHex: row.colorHex,
  );

  NoteModel _noteFromRow(Note row, List<TagModel> tags) => NoteModel(
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: tags,
  );

  LinkModel _linkFromRow(Link row, List<TagModel> tags) => LinkModel(
    id: row.id,
    title: row.title,
    url: row.url,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: tags,
  );

  Stream<List<TagModel>> watchAllTags() {
    final q = _db.select(_db.tags)
      ..orderBy([(t) => OrderingTerm.asc(t.displayName)]);
    return q.watch().map((rows) => rows.map(_tagFromRow).toList());
  }

  Stream<List<NoteModel>> watchAllNotes() {
    final notesStream = (_db.select(_db.notes)
          ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)]))
        .watch();
    final joinStream = _db.select(_db.noteTags).join([
      innerJoin(_db.tags, _db.tags.id.equalsExp(_db.noteTags.tagId)),
    ]).watch();
    return Rx.combineLatest2<List<Note>, List<TypedResult>,
        List<NoteModel>>(notesStream, joinStream, (notesRows, joinRows) {
      final tagsByNote = <String, List<TagModel>>{};
      for (final row in joinRows) {
        final nt = row.readTable(_db.noteTags);
        final tag = _tagFromRow(row.readTable(_db.tags));
        tagsByNote.putIfAbsent(nt.noteId, () => []).add(tag);
      }
      return notesRows
          .map((n) => _noteFromRow(n, tagsByNote[n.id] ?? const []))
          .toList();
    });
  }

  Stream<List<LinkModel>> watchAllLinks() {
    final linksStream = (_db.select(_db.links)
          ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)]))
        .watch();
    final joinStream = _db.select(_db.linkTags).join([
      innerJoin(_db.tags, _db.tags.id.equalsExp(_db.linkTags.tagId)),
    ]).watch();
    return Rx.combineLatest2<List<Link>, List<TypedResult>,
        List<LinkModel>>(linksStream, joinStream, (linksRows, joinRows) {
      final tagsByLink = <String, List<TagModel>>{};
      for (final row in joinRows) {
        final lt = row.readTable(_db.linkTags);
        final tag = _tagFromRow(row.readTable(_db.tags));
        tagsByLink.putIfAbsent(lt.linkId, () => []).add(tag);
      }
      return linksRows
          .map((l) => _linkFromRow(l, tagsByLink[l.id] ?? const []))
          .toList();
    });
  }

  Future<List<TagModel>> _resolveTags(List<String> displayNames) async {
    final existing = await _db.select(_db.tags).get();
    final byKey = {for (final t in existing) t.name: t};

    final out = <TagModel>[];
    final seen = <String>{};
    for (final raw in displayNames) {
      final trimmed = raw.trim();
      if (trimmed.isEmpty) continue;
      final key = trimmed.toLowerCase();
      if (seen.contains(key)) continue;
      seen.add(key);
      final existingTag = byKey[key];
      if (existingTag != null) {
        out.add(_tagFromRow(existingTag));
      } else {
        final id = _uuid.v4();
        await _db.into(_db.tags).insert(TagsCompanion.insert(
              id: id,
              displayName: trimmed,
              name: key,
            ));
        out.add(TagModel(id: id, displayName: trimmed, name: key));
      }
    }
    return out;
  }

  Future<void> _replaceNoteTags(String noteId, List<TagModel> tags) async {
    await (_db.delete(_db.noteTags)..where((t) => t.noteId.equals(noteId))).go();
    for (final t in tags) {
      await _db.into(_db.noteTags).insert(
            NoteTagsCompanion.insert(noteId: noteId, tagId: t.id),
          );
    }
  }

  Future<void> _replaceLinkTags(String linkId, List<TagModel> tags) async {
    await (_db.delete(_db.linkTags)..where((t) => t.linkId.equals(linkId))).go();
    for (final t in tags) {
      await _db.into(_db.linkTags).insert(
            LinkTagsCompanion.insert(linkId: linkId, tagId: t.id),
          );
    }
  }

  Future<void> pruneOrphanTags() async {
    // R9a: delete every tag referenced by none of the three join tables in a
    // single statement. Replaces the former per-tag triple-COUNT loop; three
    // correlated NOT EXISTS subqueries let SQLite do the work in one DELETE.
    await (_db.delete(_db.tags)
          ..where((tag) {
            final inNotes = _db.selectOnly(_db.noteTags)
              ..addColumns([_db.noteTags.tagId])
              ..where(_db.noteTags.tagId.equalsExp(tag.id));
            final inLinks = _db.selectOnly(_db.linkTags)
              ..addColumns([_db.linkTags.tagId])
              ..where(_db.linkTags.tagId.equalsExp(tag.id));
            final inShips = _db.selectOnly(_db.shipTags)
              ..addColumns([_db.shipTags.tagId])
              ..where(_db.shipTags.tagId.equalsExp(tag.id));
            return notExistsQuery(inNotes) &
                notExistsQuery(inLinks) &
                notExistsQuery(inShips);
          }))
        .go();
  }

  Future<List<TagModel>> resolveAndAttachShipTags(
    String shipId,
    List<String> displayNames,
  ) async {
    // F45: atomic tag resolution + ship-tag join replacement.
    return _db.transaction(() async {
      final tags = await _resolveTags(displayNames);
      await (_db.delete(_db.shipTags)..where((t) => t.shipId.equals(shipId)))
          .go();
      for (final t in tags) {
        await _db.into(_db.shipTags).insert(
              ShipTagsCompanion.insert(shipId: shipId, tagId: t.id),
            );
      }
      return tags;
    });
  }

  Future<NoteModel> saveNote({
    String? id,
    required String title,
    required String body,
    required List<String> tagDisplayNames,
  }) async {
    final now = DateTime.now();
    final noteId = id ?? _uuid.v4();
    // F45: keep tag resolution, the note write, join replacement and orphan
    // pruning atomic so a partial failure can't leave dangling state.
    final tags = await _db.transaction(() async {
      final resolved = await _resolveTags(tagDisplayNames);
      if (id == null) {
        await _db.into(_db.notes).insert(
              NotesCompanion.insert(
                id: noteId,
                title: Value(title),
                body: Value(body),
                createdAt: now,
                updatedAt: now,
              ),
            );
      } else {
        await (_db.update(_db.notes)..where((t) => t.id.equals(noteId))).write(
          NotesCompanion(
            title: Value(title),
            body: Value(body),
            updatedAt: Value(now),
          ),
        );
      }
      await _replaceNoteTags(noteId, resolved);
      await pruneOrphanTags();
      return resolved;
    });
    return NoteModel(
      id: noteId,
      title: title,
      body: body,
      createdAt: now,
      updatedAt: now,
      tags: tags,
    );
  }

  Future<void> deleteNote(String id) async {
    // F45: atomic delete of the note, its join rows and orphan pruning.
    await _db.transaction(() async {
      await (_db.delete(_db.noteTags)..where((t) => t.noteId.equals(id))).go();
      await (_db.delete(_db.notes)..where((t) => t.id.equals(id))).go();
      await pruneOrphanTags();
    });
  }

  Future<LinkModel> saveLink({
    String? id,
    required String title,
    required String url,
    required String note,
    required List<String> tagDisplayNames,
  }) async {
    final now = DateTime.now();
    final linkId = id ?? _uuid.v4();
    // F45: atomic tag resolution + link write + join replacement + pruning.
    final tags = await _db.transaction(() async {
      final resolved = await _resolveTags(tagDisplayNames);
      if (id == null) {
        await _db.into(_db.links).insert(
              LinksCompanion.insert(
                id: linkId,
                title: Value(title),
                url: Value(url),
                note: Value(note),
                createdAt: now,
                updatedAt: now,
              ),
            );
      } else {
        await (_db.update(_db.links)..where((t) => t.id.equals(linkId))).write(
          LinksCompanion(
            title: Value(title),
            url: Value(url),
            note: Value(note),
            updatedAt: Value(now),
          ),
        );
      }
      await _replaceLinkTags(linkId, resolved);
      await pruneOrphanTags();
      return resolved;
    });
    return LinkModel(
      id: linkId,
      title: title,
      url: url,
      note: note,
      createdAt: now,
      updatedAt: now,
      tags: tags,
    );
  }

  Future<void> deleteLink(String id) async {
    // F45: atomic delete of the link, its join rows and orphan pruning.
    await _db.transaction(() async {
      await (_db.delete(_db.linkTags)..where((t) => t.linkId.equals(id))).go();
      await (_db.delete(_db.links)..where((t) => t.id.equals(id))).go();
      await pruneOrphanTags();
    });
  }
}

final capturesRepositoryProvider = Provider<CapturesRepository>((ref) {
  return CapturesRepository(ref.watch(appDatabaseProvider));
});

final tagsStreamProvider = StreamProvider<List<TagModel>>((ref) {
  return ref.watch(capturesRepositoryProvider).watchAllTags();
});

final notesStreamProvider = StreamProvider<List<NoteModel>>((ref) {
  return ref.watch(capturesRepositoryProvider).watchAllNotes();
});

final linksStreamProvider = StreamProvider<List<LinkModel>>((ref) {
  return ref.watch(capturesRepositoryProvider).watchAllLinks();
});
