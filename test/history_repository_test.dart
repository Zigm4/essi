import 'dart:convert';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/tools/history/history_repository.dart';
import 'package:underdeck_app/features/tools/scan/data/scan_repository.dart';
import 'package:underdeck_app/features/tools/scan/domain/scan_models.dart';

void main() {
  late AppDatabase db;
  late ScanRepository repo;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repo = ScanRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Future<void> insert(String id, DateTime date, String payloadJson) {
    return db.into(db.scanHistory).insert(
          ScanHistoryCompanion.insert(
            id: id,
            date: date,
            mode: ScanMode.light.id,
            payloadJson: payloadJson,
          ),
        );
  }

  test('watchAll caps at kHistoryLimit, newest first (F23)', () async {
    expect(kHistoryLimit, 100);
    final base = DateTime.utc(2020);
    for (var i = 0; i < kHistoryLimit + 5; i++) {
      await insert(
        'id-$i',
        base.add(Duration(days: i)),
        jsonEncode({'snapshots': []}),
      );
    }

    final entries = await repo.watchAll().first;

    expect(entries.length, kHistoryLimit);
    // Newest first, and the oldest 5 rows are dropped by the limit.
    expect(entries.first.id, 'id-104');
    expect(entries.last.id, 'id-5');
  });

  test('payload is decoded lazily and cached (F23)', () async {
    await insert('ok', DateTime.utc(2020), jsonEncode({'snapshots': []}));

    final entry = (await repo.watchAll().first).single;
    final first = entry.detail;
    expect(first, isEmpty);
    // Second access returns the cached instance (no re-decode).
    expect(identical(entry.detail, first), isTrue);
  });

  test('a corrupt row lists without erroring the stream; detail throws',
      () async {
    await insert('good', DateTime.utc(2020, 1, 1), jsonEncode({'snapshots': []}));
    await insert('bad', DateTime.utc(2020, 1, 2), 'this is not json');

    // The list mapper only reads columns, so the corrupt row is still listed
    // (F16 tolerance preserved) — no whole-stream error.
    final entries = await repo.watchAll().first;
    expect(entries.map((e) => e.id), ['bad', 'good']);

    final bad = entries.firstWhere((e) => e.id == 'bad');
    expect(() => bad.detail, throwsFormatException);

    final good = entries.firstWhere((e) => e.id == 'good');
    expect(good.detail, isEmpty);
  });
}
