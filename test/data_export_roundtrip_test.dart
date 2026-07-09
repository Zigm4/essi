import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/tools/scan/data/scan_repository.dart';
import 'package:underdeck_app/services/data_export.dart';

/// Writes an export payload map to a real temp file (dart:io, no plugins) so it
/// can be fed back through [DataExportService.importFromFile].
File _writeTempJson(Map<String, dynamic> payload) {
  final dir = Directory.systemTemp.createTempSync('underdeck-export-test');
  final file = File('${dir.path}/backup.json');
  file.writeAsStringSync(jsonEncode(payload));
  return file;
}

/// Wraps a `data` object in the export envelope.
Map<String, dynamic> _envelope(Map<String, dynamic> data) => {
      'version': 1,
      'app': 'Underdeck',
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'data': data,
    };

void main() {
  late AppDatabase source;
  late AppDatabase target;

  setUp(() {
    source = AppDatabase.forTesting(NativeDatabase.memory());
    target = AppDatabase.forTesting(NativeDatabase.memory());
  });

  tearDown(() async {
    await source.close();
    await target.close();
  });

  final now = DateTime.utc(2026, 1, 2, 3, 4, 5);

  Future<void> seedNoteWithTag(
    AppDatabase db, {
    required String noteId,
    required String tagId,
    required String tagName,
    required String tagDisplay,
  }) async {
    await db.into(db.notes).insert(NotesCompanion.insert(
          id: noteId,
          title: const Value('Mining spot'),
          body: const Value('Rich deposit'),
          createdAt: now,
          updatedAt: now,
        ));
    await db.into(db.tags).insert(TagsCompanion.insert(
          id: tagId,
          displayName: tagDisplay,
          name: tagName,
        ));
    await db.into(db.noteTags).insert(
          NoteTagsCompanion.insert(noteId: noteId, tagId: tagId),
        );
  }

  test('(a) full export->import round-trip is lossless including tag associations',
      () async {
    await seedNoteWithTag(
      source,
      noteId: 'note-1',
      tagId: 'tag-mining',
      tagName: 'mining',
      tagDisplay: 'Mining',
    );
    await source.into(source.scanHistory).insert(ScanHistoryCompanion.insert(
          id: 'scan-1',
          date: now,
          mode: 'light',
          payloadJson: jsonEncode({'snapshots': const []}),
        ));

    final exported = await DataExportService(source).collect();
    final file = _writeTempJson(exported);
    final summary = await DataExportService(target).importFromFile(file);

    expect(summary.notes, 1);
    expect(summary.tags, 1);
    expect(summary.scanHistory, 1);

    final notes = await target.select(target.notes).get();
    expect(notes.map((n) => n.id), contains('note-1'));

    final noteTags = await target.select(target.noteTags).get();
    expect(
      noteTags.any((nt) => nt.noteId == 'note-1' && nt.tagId == 'tag-mining'),
      isTrue,
      reason: 'tag association must survive the round-trip',
    );

    final scans = await target.select(target.scanHistory).get();
    expect(scans.map((s) => s.id), contains('scan-1'));
  });

  test('(b) H3 tag-name collision: imported note stays tagged via remap',
      () async {
    // Target already has a tag named "mining" but with a DIFFERENT uuid.
    await target.into(target.tags).insert(TagsCompanion.insert(
          id: 'local-mining-Y',
          displayName: 'Mining',
          name: 'mining',
        ));

    // Backup: a note tagged "mining" under uuid X.
    await seedNoteWithTag(
      source,
      noteId: 'note-b',
      tagId: 'imported-mining-X',
      tagName: 'mining',
      tagDisplay: 'Mining',
    );

    final exported = await DataExportService(source).collect();
    final file = _writeTempJson(exported);
    await DataExportService(target).importFromFile(file);

    final noteTags = await target.select(target.noteTags).get();
    final forNote = noteTags.where((nt) => nt.noteId == 'note-b').toList();
    expect(
      forNote,
      isNotEmpty,
      reason: 'H3: the imported note must remain tagged after a name collision',
    );
    // The association must point at the pre-existing local tag id (remapped).
    expect(forNote.single.tagId, 'local-mining-Y');
  });

  test('(c) F16 corrupt history payload must not brick watchAll()', () async {
    final data = {
      'scanHistory': [
        {
          'id': 'good',
          'date': now.toIso8601String(),
          'mode': 'light',
          'payloadJson': jsonEncode({'snapshots': const []}),
          'errored': false,
        },
        {
          'id': 'corrupt',
          'date': now.toIso8601String(),
          'mode': 'light',
          'payloadJson': 'this is not valid json {{{',
          'errored': false,
        },
      ],
    };
    final file = _writeTempJson(_envelope(data));
    await DataExportService(target).importFromFile(file);

    final repo = ScanRepository(target);
    // Must not throw / error the stream.
    final records = await repo.watchAll().first;
    expect(records.map((r) => r.id), contains('good'));
    expect(records.map((r) => r.id), isNot(contains('corrupt')));
  });

  test('(d) F36/F42 re-importing same backup reports 0 new history rows',
      () async {
    await source.into(source.scanHistory).insert(ScanHistoryCompanion.insert(
          id: 'scan-dup',
          date: now,
          mode: 'light',
          payloadJson: jsonEncode({'snapshots': const []}),
        ));

    final exported = await DataExportService(source).collect();
    final file = _writeTempJson(exported);

    final first = await DataExportService(target).importFromFile(file);
    expect(first.scanHistory, 1);

    final second = await DataExportService(target).importFromFile(file);
    expect(second.scanHistory, 0,
        reason: 'F36/F42: already-present history rows must not be recounted');
  });

  test('(F60) malformed file surfaces a friendly message', () async {
    final dir = Directory.systemTemp.createTempSync('underdeck-bad');
    final file = File('${dir.path}/bad.json')..writeAsStringSync('not json at all');
    expect(
      () => DataExportService(target).importFromFile(file),
      throwsA(isA<FormatException>().having(
        (e) => e.message,
        'message',
        contains("isn't a valid Underdeck export"),
      )),
    );
  });

  test('(e) F43 newer-wins update preserves the original createdAt', () async {
    final created = DateTime.utc(2025, 6, 1);
    final oldUpdated = DateTime.utc(2025, 6, 1);
    final newerUpdated = DateTime.utc(2026, 1, 1);

    // Target already has the note (created long ago).
    await target.into(target.notes).insert(NotesCompanion.insert(
          id: 'note-e',
          title: const Value('Original'),
          body: const Value('old body'),
          createdAt: created,
          updatedAt: oldUpdated,
        ));

    // Backup carries a NEWER edit of the same note, with createdAt OMITTED —
    // the exact case that used to overwrite createdAt with DateTime.now().
    final data = {
      'notes': [
        {
          'id': 'note-e',
          'title': 'Edited',
          'body': 'new body',
          'updatedAt': newerUpdated.toIso8601String(),
        },
      ],
    };
    final summary =
        await DataExportService(target).importFromFile(_writeTempJson(_envelope(data)));
    expect(summary.notes, 1, reason: 'newer copy should be applied');

    final row = await (target.select(target.notes)
          ..where((t) => t.id.equals('note-e')))
        .getSingle();
    expect(row.body, 'new body', reason: 'newer edit applied');
    // Compare the instant, not the isUtc flag: drift stores dates as epoch and
    // reads them back as local DateTimes (same moment, different isUtc).
    expect(row.createdAt.isAtSameMomentAs(created), isTrue,
        reason: 'F43: update must not clobber the original createdAt');
  });

  test('(f) a history row with a garbage date does not abort the whole import',
      () async {
    final data = {
      'scanHistory': [
        {
          'id': 'good',
          'date': now.toIso8601String(),
          'mode': 'light',
          'payloadJson': jsonEncode({'snapshots': const []}),
          'errored': false,
        },
        {
          'id': 'bad-date',
          'date': 'not-a-real-date',
          'mode': 'light',
          'payloadJson': jsonEncode({'snapshots': const []}),
          'errored': false,
        },
      ],
    };
    final file = _writeTempJson(_envelope(data));

    // Must not throw (previously DateTime.parse threw and aborted the import).
    final summary = await DataExportService(target).importFromFile(file);
    expect(summary.scanHistory, greaterThanOrEqualTo(1));

    final scans = await target.select(target.scanHistory).get();
    expect(scans.map((s) => s.id), contains('good'),
        reason: 'the valid row must still import despite a sibling bad date');
  });
}
