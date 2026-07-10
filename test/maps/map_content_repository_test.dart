import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_blob_store.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_content_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fetcher.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_integrity.dart';

/// URL-keyed fake adapter that also counts hits per URL (to prove differential
/// reuse skips already-present blobs).
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.routes);
  final List<MapEntry<String, List<int>>> routes;
  final Map<String, int> hitCount = {};

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _,
      Future<void>? cancelFuture) async {
    final url = options.uri.toString();
    final match = routes.firstWhere(
      (r) => url.contains(r.key),
      orElse: () => throw StateError('no route for $url'),
    );
    hitCount.update(match.key, (v) => v + 1, ifAbsent: () => 1);
    return ResponseBody.fromBytes(match.value, 200,
        headers: const {
          'etag': ['W/"ptr1"'],
        });
  }

  @override
  void close({bool force = false}) {}
}

Uint8List _enc(Object json) => Uint8List.fromList(utf8.encode(jsonEncode(json)));

void main() {
  const tag = 'maps-v1.0.0';
  const cdnBase =
      'https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@$tag';

  late Directory tmp;
  late AppDatabase db;
  late MapBlobStore store;
  late SharedPreferences prefs;

  // Build a valid pointer -> manifest -> document chain with correct shas/bytes.
  late Uint8List docBytes;
  late Uint8List manifestBytes;
  late Uint8List pointerBytes;
  late _FakeAdapter adapter;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('maprepo_test');
    db = AppDatabase.forTesting(NativeDatabase.memory());
    store = MapBlobStore(Directory(p.join(tmp.path, 'blobs')));
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();

    final document = {
      'schemaVersion': 1,
      'id': 'dungeon',
      'type': 'flat',
      'canvas': {'width': 100, 'height': 100},
      'fieldsSchema': [
        {'key': 'loot', 'label': 'Loot', 'type': 'stringList', 'searchable': true},
      ],
      'zones': [
        {
          'id': 'z-entry',
          'name': 'Hall of Chains',
          'geometry': {
            'kind': 'polygon',
            'rings': [[[0, 0], [10, 0], [10, 10]]],
          },
          'fields': {
            'loot': ['Rusted key'],
          },
        },
      ],
    };
    docBytes = _enc(document);

    final manifest = {
      'schemaVersion': 1,
      'contentVersion': '1.0.0',
      'minAppVersion': '0.1.0',
      'cdnBase': cdnBase,
      'maps': [
        {
          'id': 'dungeon',
          'type': 'flat',
          'title': 'Hideous Dungeon',
          'icon': 'dungeon',
          'version': 1,
          'draft': false,
          'document': {
            'path': 'maps/dungeon/map.json',
            'sha256': sha256Hex(docBytes),
            'bytes': docBytes.length,
          },
          'assets': const <dynamic>[],
        },
      ],
    };
    manifestBytes = _enc(manifest);

    final pointer = {
      'schemaVersion': 1,
      'contentVersion': '1.0.0',
      'tag': tag,
      'minAppVersion': '0.1.0',
      'manifest': {
        'path': 'maps-manifest.json',
        'sha256': sha256Hex(manifestBytes),
        'bytes': manifestBytes.length,
      },
    };
    pointerBytes = _enc(pointer);

    adapter = _FakeAdapter([
      MapEntry('underpunks55.github.io', pointerBytes),
      MapEntry('maps-manifest.json', manifestBytes),
      MapEntry('maps/dungeon/map.json', docBytes),
    ]);
  });

  tearDown(() async {
    await db.close();
    if (await tmp.exists()) await tmp.delete(recursive: true);
  });

  MapContentRepository buildRepo() => MapContentRepository(
        db: db,
        store: store,
        fetcher: MapFetcher(Dio()..httpClientAdapter = adapter),
        prefs: prefs,
      );

  test('checkForUpdate returns available; disabled + throttle honoured',
      () async {
    final repo = buildRepo();

    // Disabled network → no fetch.
    expect(
      await repo.checkForUpdate(networkEnabled: false, appVersion: '0.2.0'),
      isA<MapUpdateDisabled>(),
    );

    // Enabled → available.
    final outcome = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
      now: DateTime(2026, 1, 1),
    );
    expect(outcome, isA<MapUpdateAvailable>());

    // A second immediate check is throttled (<24h).
    final again = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
      now: DateTime(2026, 1, 1, 1),
    );
    expect(again, isA<MapUpdateThrottled>());

    // force bypasses the throttle.
    final forced = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
      now: DateTime(2026, 1, 1, 2),
      force: true,
    );
    expect(forced, isA<MapUpdateAvailable>());
  });

  test('minAppVersion gate blocks an older app', () async {
    final repo = buildRepo();
    final outcome = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.0.9', // < minAppVersion 0.1.0
    );
    expect(outcome, isA<MapUpdateBlockedByAppVersion>());
    expect(
      (outcome as MapUpdateBlockedByAppVersion).minAppVersion,
      '0.1.0',
    );
  });

  test('install commits pack + files + FTS; reads come from the store',
      () async {
    final repo = buildRepo();
    final outcome = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
    );
    await repo.install(outcome as MapUpdateAvailable,
        now: DateTime(2026, 1, 1));

    // MapPacks + MapPackFiles rows are present.
    final packs = await db.select(db.mapPacks).get();
    expect(packs.single.contentVersion, '1.0.0');
    expect(packs.single.state, 'installed');
    final files = await db.select(db.mapPackFiles).get();
    expect(
      files.map((f) => f.logicalPath),
      containsAll(<String>['manifest.json', 'maps/dungeon/map.json']),
    );

    // Blobs are on disk (content-addressed).
    expect(await store.exists(sha256Hex(docBytes)), isTrue);
    expect(await store.exists(sha256Hex(manifestBytes)), isTrue);

    // FTS row is queryable.
    final hits = await db
        .customSelect(
          'SELECT zone_id, map_id FROM $kMapZoneFtsTable '
          "WHERE $kMapZoneFtsTable MATCH 'rusted'",
        )
        .get();
    expect(hits.single.read<String>('zone_id'), 'z-entry');

    // Offline reads resolve from the store, not the network.
    final manifest = await repo.loadInstalledManifest();
    expect(manifest!.maps.single.id, 'dungeon');
    final document = await repo.loadDocument('dungeon');
    expect(document!.zones.single.name, 'Hall of Chains');
    expect(await repo.loadDocument('does-not-exist'), isNull);
  });

  test('differential reuse: a second install skips already-present blobs',
      () async {
    final repo = buildRepo();
    final outcome = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
    );
    final available = outcome as MapUpdateAvailable;
    await repo.install(available, now: DateTime(2026, 1, 1));

    final docHitsAfterFirst = adapter.hitCount['maps/dungeon/map.json'];
    expect(docHitsAfterFirst, 1);

    // Re-install the same content: the document blob already exists, so no new
    // fetch of it happens.
    await repo.install(available, now: DateTime(2026, 1, 2));
    expect(adapter.hitCount['maps/dungeon/map.json'], docHitsAfterFirst,
        reason: 'existing blob must be reused, not re-downloaded');
  });

  test('gc removes an orphaned blob not referenced by any pack', () async {
    final repo = buildRepo();
    // Seed an orphan blob directly.
    final orphan = Uint8List.fromList(utf8.encode('orphan'));
    final orphanSha = sha256Hex(orphan);
    await store.write(orphan, orphanSha);

    final outcome = await repo.checkForUpdate(
      networkEnabled: true,
      appVersion: '0.2.0',
    );
    await repo.install(outcome as MapUpdateAvailable);

    // Install already GC'd once; the orphan should be gone, referenced blobs
    // intact.
    expect(await store.exists(orphanSha), isFalse);
    expect(await store.exists(sha256Hex(docBytes)), isTrue);
    expect(await store.exists(sha256Hex(manifestBytes)), isTrue);
  });
}
