import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_blob_store.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_content_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fetcher.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_seed_importer.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_integrity.dart';

/// In-memory asset bundle: serves fixed bytes per asset key.
class _FakeBundle extends CachingAssetBundle {
  _FakeBundle(this.assets);
  final Map<String, Uint8List> assets;

  @override
  Future<ByteData> load(String key) async {
    final b = assets[key];
    if (b == null) {
      throw FlutterError('no fake asset for "$key"');
    }
    return ByteData.view(b.buffer, b.offsetInBytes, b.lengthInBytes);
  }
}

Uint8List _enc(Object json) => Uint8List.fromList(utf8.encode(jsonEncode(json)));

const _docKey = 'assets/maps_seed/dungeon.map.json';
const _imgKey = 'assets/knowledge/images/hideous-dungeon-map.jpg';

/// A seed manifest carrying the single dungeon map at [contentVersion].
/// sha/bytes are placeholders — the importer recomputes them.
Map<String, dynamic> _manifestJson({required String contentVersion}) => {
      'schemaVersion': 1,
      'contentVersion': contentVersion,
      'minAppVersion': '0.1.0',
      'cdnBase': 'asset:///seed',
      'maps': [
        {
          'id': 'dungeon',
          'type': 'flat',
          'title': 'Hideous Dungeon',
          'icon': 'dungeon',
          'draft': false,
          'document': {'path': _docKey, 'sha256': '0' * 64, 'bytes': 0},
          'assets': [
            {
              'path': _imgKey,
              'sha256': '0' * 64,
              'bytes': 0,
              'kind': 'background',
              'pixelSize': [2448, 3264],
            },
          ],
        },
      ],
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tmp;
  late AppDatabase db;
  late MapBlobStore store;
  late SharedPreferences prefs;
  late _FakeBundle bundle;

  late Uint8List docBytes;
  late Uint8List imageBytes;

  const docKey = 'assets/maps_seed/dungeon.map.json';
  const imgKey = 'assets/knowledge/images/hideous-dungeon-map.jpg';

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('seed_test');
    db = AppDatabase.forTesting(NativeDatabase.memory());
    store = MapBlobStore(Directory(p.join(tmp.path, 'blobs')));
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();

    final document = {
      'schemaVersion': 1,
      'id': 'dungeon',
      'type': 'flat',
      'canvas': {'width': 2448, 'height': 3264},
      'theme': {'background': '#05070D'},
      'fieldsSchema': [
        {
          'key': 'loot',
          'label': 'Loot',
          'type': 'stringList',
          'searchable': true,
        },
      ],
      'zones': [
        {
          'id': 'z-entry',
          'name': 'Collapsed Entrance',
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
          'fields': {
            'loot': ['Rusted lantern'],
          },
        },
      ],
    };
    docBytes = _enc(document);
    imageBytes = Uint8List.fromList(List<int>.generate(2048, (i) => i % 256));

    // Seed manifest: sha/bytes are placeholders — the importer recomputes them.
    final manifest = _manifestJson(contentVersion: '0-seed');

    bundle = _FakeBundle({
      kMapSeedManifestAsset: _enc(manifest),
      docKey: docBytes,
      imgKey: imageBytes,
    });
  });

  tearDown(() async {
    await db.close();
    if (await tmp.exists()) await tmp.delete(recursive: true);
  });

  MapSeedImporter buildImporter() => MapSeedImporter(
        db: db,
        store: store,
        prefs: prefs,
        bundle: bundle,
      );

  MapContentRepository buildRepo() => MapContentRepository(
        db: db,
        store: store,
        fetcher: MapFetcher(Dio()),
        prefs: prefs,
      );

  test('imports the seed: blobs, pack rows, FTS, and offline reads', () async {
    final outcome =
        await buildImporter().ensureImported(now: DateTime(2026, 1, 1));
    expect(outcome, isA<MapSeedImported>());
    expect((outcome as MapSeedImported).mapCount, 1);

    // The imported seed version is recorded.
    expect(prefs.getString(kMapSeedVersionPref), '0-seed');

    // Pack row.
    final packs = await db.select(db.mapPacks).get();
    expect(packs.single.contentVersion, kMapSeedContentVersion);
    expect(packs.single.tag, kMapSeedTag);
    expect(packs.single.state, 'installed');

    // File index includes manifest + document + asset.
    final files = await db.select(db.mapPackFiles).get();
    expect(
      files.map((f) => f.logicalPath),
      containsAll(<String>['manifest.json', docKey, imgKey]),
    );

    // Blobs are content-addressed on disk.
    expect(await store.exists(sha256Hex(docBytes)), isTrue);
    expect(await store.exists(sha256Hex(imageBytes)), isTrue);

    // FTS row is queryable (searchable field indexed).
    final hits = await db
        .customSelect(
          'SELECT zone_id FROM $kMapZoneFtsTable '
          "WHERE $kMapZoneFtsTable MATCH 'rusted'",
        )
        .get();
    expect(hits.single.read<String>('zone_id'), 'z-entry');

    // Offline reads resolve from the store (no network).
    final repo = buildRepo();
    final manifest = await repo.loadInstalledManifest();
    expect(manifest!.maps.single.id, 'dungeon');
    final doc = await repo.loadDocument('dungeon');
    expect(doc!.zones.single.name, 'Collapsed Entrance');
    expect(doc.canvas!.width, 2448);
  });

  test('is idempotent: a second call at the same version is skipped', () async {
    final importer = buildImporter();
    await importer.ensureImported(now: DateTime(2026, 1, 1));

    final again = await importer.ensureImported(now: DateTime(2026, 1, 2));
    expect(again, isA<MapSeedSkipped>());
    expect((again as MapSeedSkipped).reason,
        MapSeedSkipReason.alreadyImported);

    // Still exactly one pack row.
    expect((await db.select(db.mapPacks).get()).length, 1);
  });

  test('skips when real content is already installed', () async {
    // Simulate a network pack installed before Knowledge was first opened.
    await db.into(db.mapPacks).insert(
          MapPacksCompanion.insert(
            contentVersion: '1.0.0',
            tag: 'maps-v1.0.0',
            manifestSha256: 'deadbeef',
            installedAt: DateTime(2026, 1, 1),
            state: 'installed',
          ),
        );

    final outcome = await buildImporter().ensureImported();
    expect(outcome, isA<MapSeedSkipped>());
    expect((outcome as MapSeedSkipped).reason,
        MapSeedSkipReason.contentAlreadyInstalled);
    // Version recorded so we don't re-check every launch.
    expect(prefs.getString(kMapSeedVersionPref), '0-seed');
    // No seed pack row was added.
    final packs = await db.select(db.mapPacks).get();
    expect(packs.single.contentVersion, '1.0.0');
  });

  test('failure leaves no flag set so the caller can retry', () async {
    // A bundle missing the manifest asset ⇒ FlutterError ⇒ MapSeedFailed.
    final broken = MapSeedImporter(
      db: db,
      store: store,
      prefs: prefs,
      bundle: _FakeBundle(const {}),
    );
    final failed = await broken.ensureImported();
    expect(failed, isA<MapSeedFailed>());
    expect((failed as MapSeedFailed).diskFull, isFalse);
    expect(prefs.getString(kMapSeedVersionPref), isNull);

    // Retry with a working bundle now succeeds.
    final ok = await buildImporter().ensureImported();
    expect(ok, isA<MapSeedImported>());
  });

  test('re-imports when the bundled seed contentVersion changes', () async {
    // First launch at 0-seed.
    final first = await buildImporter().ensureImported(now: DateTime(2026, 1, 1));
    expect(first, isA<MapSeedImported>());

    // "App update": the bundle now ships 0-seed-2.
    bundle = _FakeBundle({
      kMapSeedManifestAsset: _enc(_manifestJson(contentVersion: '0-seed-2')),
      docKey: docBytes,
      imgKey: imageBytes,
    });
    final second =
        await buildImporter().ensureImported(now: DateTime(2026, 2, 1));
    expect(second, isA<MapSeedImported>(),
        reason: 'a changed bundled version must re-import: $second');
    expect(prefs.getString(kMapSeedVersionPref), '0-seed-2');

    // The old seed pack is replaced, not stacked next to the new one.
    final packs = await db.select(db.mapPacks).get();
    expect(packs.single.contentVersion, '0-seed-2');
    expect(packs.single.tag, kMapSeedTag);

    // Reads resolve against the new pack.
    final manifest = await buildRepo().loadInstalledManifest();
    expect(manifest!.contentVersion, '0-seed-2');
  });

  test('a legacy bool-flag install re-imports on a new seed version', () async {
    // Existing install: imported under the old boolean guard, version pref
    // absent — must be treated as 0-seed.
    SharedPreferences.setMockInitialValues(
        <String, Object>{kMapSeedImportedPref: true});
    prefs = await SharedPreferences.getInstance();

    // Same version bundled → still skipped (no churn for legacy installs)…
    final same = await buildImporter().ensureImported();
    expect(same, isA<MapSeedSkipped>());
    expect(
        (same as MapSeedSkipped).reason, MapSeedSkipReason.alreadyImported);

    // …but a newer bundled seed re-imports.
    bundle = _FakeBundle({
      kMapSeedManifestAsset: _enc(_manifestJson(contentVersion: '0-seed-2')),
      docKey: docBytes,
      imgKey: imageBytes,
    });
    final bumped = await buildImporter().ensureImported();
    expect(bumped, isA<MapSeedImported>());
    expect(prefs.getString(kMapSeedVersionPref), '0-seed-2');
  });

  // Guards the REAL committed seed pack (assets/maps_seed/** + the reused KB
  // image): if an authoring edit breaks the schema/bounds, this fails in CI
  // rather than shipping a dead first-launch experience.
  test('the real bundled seed pack imports and validates', () async {
    final importer = MapSeedImporter(
      db: db,
      store: store,
      prefs: prefs,
      bundle: rootBundle, // the actual pubspec-declared assets
    );
    final outcome = await importer.ensureImported(now: DateTime(2026, 1, 1));
    expect(outcome, isA<MapSeedImported>(),
        reason: 'committed seed content must validate: $outcome');
    expect((outcome as MapSeedImported).mapCount, greaterThanOrEqualTo(1));

    final repo = buildRepo();
    final manifest = await repo.loadInstalledManifest();
    expect(manifest, isNotNull);
    final doc = await repo.loadDocument('hideous-dungeon');
    expect(doc, isNotNull);
    expect(doc!.type.name, 'flat');
    expect(doc.zones, isNotEmpty);
    // The reused background asset blob is present and within bounds.
    final bgSha = manifest!.maps
        .firstWhere((m) => m.id == 'hideous-dungeon')
        .assets
        .single
        .sha256;
    expect(await store.exists(bgSha), isTrue);
  });
}
