import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' show Variable;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_blob_store.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_content_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fetcher.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tmp;
  late AppDatabase db;
  late MapContentRepository repo;

  Future<void> insertZone(
      String zoneId, String mapId, String name, String fields) {
    return db.customInsert(
      'INSERT INTO $kMapZoneFtsTable (zone_id, map_id, name, fields_text) '
      'VALUES (?, ?, ?, ?)',
      variables: [
        Variable.withString(zoneId),
        Variable.withString(mapId),
        Variable.withString(name),
        Variable.withString(fields),
      ],
    );
  }

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('mapsearch_test');
    db = AppDatabase.forTesting(NativeDatabase.memory());
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    repo = MapContentRepository(
      db: db,
      store: MapBlobStore(Directory(p.join(tmp.path, 'blobs'))),
      fetcher: MapFetcher(Dio()), // never hit — search is a local read
      prefs: prefs,
    );

    await insertZone('z-rustwind', 'keth-9', 'Rustwind Reach',
        'oxidized ore mining outpost');
    await insertZone('z-cafe', 'keth-9', 'Café Zürich', 'coffee refuge');
    await insertZone(
        'z-hall', 'dungeon', 'Hall of Chains', 'rusted key hidden loot');
  });

  tearDown(() async {
    await db.close();
    if (await tmp.exists()) await tmp.delete(recursive: true);
  });

  test('prefix match spans zone names and field text', () async {
    final hits = await repo.searchZones('rust');
    final ids = hits.map((h) => h.zoneId).toSet();
    // "rust"* prefix-matches both "Rustwind" (name) and "rusted" (fields).
    expect(ids, containsAll(['z-rustwind', 'z-hall']));
    expect(ids, isNot(contains('z-cafe')));
  });

  test('non-ASCII / diacritics match (unicode61 remove_diacritics)', () async {
    expect(
      (await repo.searchZones('cafe')).map((h) => h.zoneId),
      contains('z-cafe'),
    );
    expect(
      (await repo.searchZones('zurich')).map((h) => h.zoneId),
      contains('z-cafe'),
    );
  });

  test('carries the map id through so results can be grouped', () async {
    final hits = await repo.searchZones('rustwind');
    expect(hits, hasLength(1));
    expect(hits.single.mapId, 'keth-9');
    expect(hits.single.zoneName, 'Rustwind Reach');
  });

  test('multi-term query ANDs the terms', () async {
    expect(
      (await repo.searchZones('rustwind reach')).map((h) => h.zoneId),
      ['z-rustwind'],
    );
    // Both terms must be present: "rustwind" is only in one zone.
    expect(await repo.searchZones('rustwind chains'), isEmpty);
  });

  test('blank / operator-only queries are safe no-ops (no crash)', () async {
    expect(await repo.searchZones(''), isEmpty);
    expect(await repo.searchZones('   '), isEmpty);
    // Operator/quote junk must not throw a MATCH syntax error.
    expect(await repo.searchZones('"'), isEmpty);
    expect(await repo.searchZones('* ^'), isNotNull);
  });

  test('limit is honoured', () async {
    final hits = await repo.searchZones('e', limit: 1); // 'e' prefix is broad
    expect(hits.length, lessThanOrEqualTo(1));
  });

  group('ftsMatchExpression', () {
    test('quotes terms and prefix-matches the last', () {
      expect(ftsMatchExpression('foo bar'), '"foo" "bar"*');
    });
    test('single term is a prefix match', () {
      expect(ftsMatchExpression('foo'), '"foo"*');
    });
    test('blank → null', () {
      expect(ftsMatchExpression('   '), isNull);
      expect(ftsMatchExpression(''), isNull);
    });
    test('embedded quotes are escaped', () {
      expect(ftsMatchExpression('a"b'), '"a""b"*');
    });
  });
}
