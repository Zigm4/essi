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

/// Minimal URL-keyed fake adapter (mirrors map_content_repository_test).
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.routes);
  final List<MapEntry<String, List<int>>> routes;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _,
      Future<void>? cancelFuture) async {
    final url = options.uri.toString();
    final match = routes.firstWhere((r) => url.contains(r.key),
        orElse: () => throw StateError('no route for $url'));
    return ResponseBody.fromBytes(match.value, 200, headers: const {
      'etag': ['W/"ptr1"'],
    });
  }

  @override
  void close({bool force = false}) {}
}

Uint8List _enc(Object json) => Uint8List.fromList(utf8.encode(jsonEncode(json)));

void main() {
  group('MapBlobStore.totalBytes', () {
    late Directory tmp;
    late MapBlobStore store;

    setUp(() async {
      tmp = await Directory.systemTemp.createTemp('blobsize_test');
      store = MapBlobStore(Directory(p.join(tmp.path, 'maps_store', 'blobs')));
    });
    tearDown(() async {
      if (await tmp.exists()) await tmp.delete(recursive: true);
    });

    test('is 0 for an empty (non-existent) store', () async {
      expect(await store.totalBytes(), 0);
    });

    test('sums the size of every stored blob', () async {
      final a = Uint8List.fromList(List.filled(100, 1));
      final b = Uint8List.fromList(List.filled(250, 2));
      await store.write(a, sha256Hex(a));
      await store.write(b, sha256Hex(b));
      expect(await store.totalBytes(), 350);

      // GC to empty keep set → store is empty again.
      await store.gc(keep: const {});
      expect(await store.totalBytes(), 0);
    });
  });

  group('MapContentRepository.clearAllContent', () {
    const tag = 'maps-v1.0.0';
    const cdnBase =
        'https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@$tag';

    late Directory tmp;
    late AppDatabase db;
    late MapBlobStore store;
    late SharedPreferences prefs;
    late _FakeAdapter adapter;
    late Uint8List manifestBytes;

    setUp(() async {
      tmp = await Directory.systemTemp.createTemp('mapclear_test');
      db = AppDatabase.forTesting(NativeDatabase.memory());
      store = MapBlobStore(Directory(p.join(tmp.path, 'blobs')));
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();

      final document = {
        'schemaVersion': 1,
        'id': 'dungeon',
        'type': 'flat',
        'canvas': {'width': 100, 'height': 100},
        'fieldsSchema': const <dynamic>[],
        'zones': [
          {
            'id': 'z-entry',
            'name': 'Hall of Chains',
            'geometry': {
              'kind': 'polygon',
              'rings': [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                ],
              ],
            },
            'fields': const <String, dynamic>{},
          },
        ],
      };
      final docBytes = _enc(document);

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

      adapter = _FakeAdapter([
        MapEntry('underpunks55.github.io', _enc(pointer)),
        MapEntry('maps-manifest.json', manifestBytes),
        MapEntry('maps/dungeon/map.json', docBytes),
      ]);
    });

    tearDown(() async {
      await db.close();
      if (await tmp.exists()) await tmp.delete(recursive: true);
    });

    test('wipes packs, files, FTS, blobs, and pointer prefs', () async {
      final repo = MapContentRepository(
        db: db,
        store: store,
        fetcher: MapFetcher(Dio()..httpClientAdapter = adapter),
        prefs: prefs,
      );

      final outcome = await repo.checkForUpdate(
        networkEnabled: true,
        appVersion: '0.2.0',
        now: DateTime(2026, 1, 1),
      );
      await repo.install(outcome as MapUpdateAvailable,
          now: DateTime(2026, 1, 1));

      // Sanity: content is installed and the store is non-empty.
      expect((await db.select(db.mapPacks).get()), isNotEmpty);
      expect(await repo.storeSizeBytes(), greaterThan(0));
      expect(await repo.installedContentVersion(), '1.0.0');
      // The check persisted an ETag + last-check timestamp.
      expect(prefs.getString('maps.pointerEtag'), isNotNull);
      expect(prefs.getInt('maps.lastCheckAt'), isNotNull);

      await repo.clearAllContent();

      expect(await db.select(db.mapPacks).get(), isEmpty);
      expect(await db.select(db.mapPackFiles).get(), isEmpty);
      final fts = await db
          .customSelect('SELECT COUNT(*) AS c FROM $kMapZoneFtsTable')
          .getSingle();
      expect(fts.read<int>('c'), 0);
      expect(await repo.storeSizeBytes(), 0);
      expect(await repo.installedContentVersion(), isNull);
      expect(await repo.loadInstalledManifest(), isNull);
      expect(prefs.getString('maps.pointerEtag'), isNull);
      expect(prefs.getInt('maps.lastCheckAt'), isNull);
    });
  });
}
