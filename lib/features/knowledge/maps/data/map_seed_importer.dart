import 'dart:convert';
import 'dart:io' show FileSystemException;

import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:flutter/services.dart' show AssetBundle, rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/logging.dart';
import '../../../../data/database/app_database.dart';
import '../../../../services/app_settings.dart';
import '../domain/map_integrity.dart';
import '../domain/map_models.dart';
import '../domain/map_validator.dart';
import 'map_blob_store.dart';
import 'map_content_repository.dart';
import 'map_fts_index.dart';

/// Content version of the bundled seed pack. Sorts *below* every real content
/// version (see [compareContentVersions]: `'0-seed'` → `[0, 0]`), so an
/// installed network pack always supersedes it and anti-rollback never lets the
/// seed clobber real content.
const String kMapSeedContentVersion = '0-seed';

/// Tag recorded for the seed pack (it has no upstream git tag).
const String kMapSeedTag = 'seed';

/// Asset key of the bundled seed manifest (see `pubspec.yaml` assets, §4.7).
const String kMapSeedManifestAsset = 'assets/maps_seed/manifest.json';

/// Prefs flag: the seed has been imported (or deliberately skipped) once, so we
/// never re-run the import on subsequent launches.
const String kMapSeedImportedPref = 'maps.seedImported';

/// Blobs at or above this size are hashed on a background isolate (via
/// `compute`) to keep a large seed image off the UI isolate; smaller blobs hash
/// inline (isolate spin-up would cost more than it saves).
const int _kIsolateHashThreshold = 256 * 1024;

/// Outcome of [MapSeedImporter.ensureImported]. UI (M1) switches on this to
/// decide what to show at Knowledge entry.
sealed class MapSeedOutcome {
  const MapSeedOutcome();
}

/// The seed pack was imported into the store this call. [mapCount] non-draft
/// maps are now readable offline.
class MapSeedImported extends MapSeedOutcome {
  final int mapCount;
  const MapSeedImported(this.mapCount);
}

/// Nothing to do: the seed was already imported previously, or real content is
/// already installed (which supersedes the seed).
class MapSeedSkipped extends MapSeedOutcome {
  final MapSeedSkipReason reason;
  const MapSeedSkipped(this.reason);
}

enum MapSeedSkipReason { alreadyImported, contentAlreadyInstalled }

/// The import failed. The prefs flag is NOT set, so the caller can safely retry
/// (e.g. a user-visible "Retry" that `ref.invalidate`s the import provider).
///
/// FAILURE UX (M1 contract): render a real empty state, never a mystery blank.
/// - [diskFull] true  → "Storage full — free up space and retry." + Retry.
/// - otherwise        → "Couldn't set up offline maps." + Retry (details logged).
class MapSeedFailed extends MapSeedOutcome {
  final Object error;

  /// Best-effort detection that the underlying cause was an out-of-space write
  /// (POSIX `ENOSPC` = 28). Drives the disk-full copy in the empty state.
  final bool diskFull;

  const MapSeedFailed(this.error, {this.diskFull = false});
}

/// A blob to persist: its content-address [sha256] and [bytes].
class _SeedBlob {
  final String sha256;
  final Uint8List bytes;
  const _SeedBlob(this.sha256, this.bytes);
}

/// Raised internally when the bundled seed content fails validation. This is a
/// build-time authoring error (the seed ships with the binary), surfaced as a
/// [MapSeedFailed] rather than thrown to callers.
class MapSeedException implements Exception {
  final String message;
  const MapSeedException(this.message);
  @override
  String toString() => 'MapSeedException: $message';
}

/// Imports the bundled seed pack into the offline blob store + Drift index so
/// the dynamic-maps feature is fully functional on first launch with no network
/// (airplane mode). Runs lazily, once, guarded by [kMapSeedImportedPref].
///
/// Unlike the network path ([MapContentRepository.install]) the seed is NOT
/// re-hashed over the wire — it is authenticated by the app-store signature that
/// covers the whole binary. We still compute a local sha256 per blob because the
/// blob store is content-addressed (the sha256 IS the on-disk key), but we use
/// [MapBlobStore.writeTrusted] to avoid hashing each blob twice.
class MapSeedImporter {
  final AppDatabase _db;
  final MapBlobStore _store;
  final SharedPreferences _prefs;
  final AssetBundle _bundle;
  final MapContentValidator _validator;

  MapSeedImporter({
    required AppDatabase db,
    required MapBlobStore store,
    required SharedPreferences prefs,
    AssetBundle? bundle,
    MapContentValidator validator = const MapContentValidator(),
  })  : _db = db,
        _store = store,
        _prefs = prefs,
        _bundle = bundle ?? rootBundle,
        _validator = validator;

  /// Imports the seed if it has not been imported and no real content pack is
  /// installed. Never throws — failures come back as [MapSeedFailed].
  Future<MapSeedOutcome> ensureImported({DateTime? now}) async {
    if (_prefs.getBool(kMapSeedImportedPref) ?? false) {
      return const MapSeedSkipped(MapSeedSkipReason.alreadyImported);
    }

    try {
      // If real content is already installed (e.g. the user was online before
      // Knowledge was first opened), the seed is redundant — flag & skip.
      final existing = await (_db.select(_db.mapPacks)
            ..where((t) => t.state.equals('installed')))
          .get();
      if (existing.isNotEmpty) {
        await _prefs.setBool(kMapSeedImportedPref, true);
        return const MapSeedSkipped(MapSeedSkipReason.contentAlreadyInstalled);
      }

      final imported = await _import(now: now ?? DateTime.now());
      await _prefs.setBool(kMapSeedImportedPref, true);
      return imported;
    } on FileSystemException catch (e, s) {
      logError(e, s);
      return MapSeedFailed(e, diskFull: e.osError?.errorCode == 28);
    } catch (e, s) {
      logError(e, s);
      return MapSeedFailed(e);
    }
  }

  Future<MapSeedImported> _import({required DateTime now}) async {
    // 1. Load + decode the seed manifest from the bundle.
    final manifestStr = await _bundle.loadString(kMapSeedManifestAsset);
    final manifestJson = jsonDecode(manifestStr) as Map<String, dynamic>;

    final blobs = <_SeedBlob>[];
    final fileRows = <MapPackFilesCompanion>[];
    final ftsRows = <ZoneFtsRow>[];

    // 2. For each map, load its document + assets from the bundle, hash them,
    //    and PATCH the manifest's sha256/bytes to the real local values (the
    //    file ships with placeholders — the seed is trusted, not wire-verified).
    final maps = (manifestJson['maps'] as List<dynamic>);
    for (final rawMap in maps) {
      final mapJson = rawMap as Map<String, dynamic>;
      final draft = mapJson['draft'] as bool? ?? false;

      // Document.
      final docRef = mapJson['document'] as Map<String, dynamic>;
      final docPath = docRef['path'] as String;
      final docBytes = await _loadAsset(docPath);
      final docSha = await _sha(docBytes);
      docRef['sha256'] = docSha;
      docRef['bytes'] = docBytes.length;
      if (!draft) blobs.add(_SeedBlob(docSha, docBytes));

      // Assets.
      final assets = (mapJson['assets'] as List<dynamic>?) ?? const [];
      for (final rawAsset in assets) {
        final assetRef = rawAsset as Map<String, dynamic>;
        final assetPath = assetRef['path'] as String;
        final assetBytes = await _loadAsset(assetPath);
        final assetSha = await _sha(assetBytes);
        assetRef['sha256'] = assetSha;
        assetRef['bytes'] = assetBytes.length;
        if (!draft) blobs.add(_SeedBlob(assetSha, assetBytes));
      }
    }

    // 3. Re-encode + validate the patched manifest.
    final manifestBytes =
        Uint8List.fromList(utf8.encode(jsonEncode(manifestJson)));
    final manifestSha = await _sha(manifestBytes);
    final manifestRes = _validator.validateManifest(
      manifestJson,
      byteLength: manifestBytes.length,
    );
    if (manifestRes is! MapParseOk<MapsManifest>) {
      throw MapSeedException('seed manifest invalid: $manifestRes');
    }
    final manifest = manifestRes.value;
    final cv = manifest.contentVersion;

    // 4. Validate every non-draft document and project its FTS rows.
    final files = <MapPackFilesCompanion>[
      MapPackFilesCompanion.insert(
        contentVersion: cv,
        logicalPath: 'manifest.json',
        sha256: manifestSha,
        bytes: manifestBytes.length,
        kind: const Value('manifest'),
      ),
    ];
    var mapCount = 0;
    for (final d in manifest.maps) {
      if (d.draft) continue;
      final docBlob = blobs.firstWhere((b) => b.sha256 == d.document.sha256);
      final docRes = _validator.validateDocument(
        jsonDecode(utf8.decode(docBlob.bytes)) as Map<String, dynamic>,
        byteLength: docBlob.bytes.length,
      );
      if (docRes is! MapParseOk<MapDocument>) {
        throw MapSeedException('seed map ${d.id}: invalid document ($docRes)');
      }
      mapCount++;
      files.add(MapPackFilesCompanion.insert(
        contentVersion: cv,
        logicalPath: d.document.path,
        sha256: d.document.sha256,
        bytes: d.document.bytes,
        kind: const Value('document'),
      ));
      ftsRows.addAll(buildZoneFtsRows(docRes.value));
      for (final a in d.assets) {
        files.add(MapPackFilesCompanion.insert(
          contentVersion: cv,
          logicalPath: a.path,
          sha256: a.sha256,
          bytes: a.bytes,
          kind: Value(a.kind ?? 'asset'),
        ));
      }
    }
    fileRows.addAll(files);

    // 5. Persist blobs (trusted — already hashed above). A disk-full write
    //    throws FileSystemException, caught by ensureImported → MapSeedFailed.
    await _store.writeTrusted(manifestBytes, manifestSha);
    for (final b in blobs) {
      await _store.writeTrusted(b.bytes, b.sha256);
    }

    // 6. Commit the pack index + FTS transactionally.
    await _db.transaction(() async {
      await _db.into(_db.mapPacks).insertOnConflictUpdate(
            MapPacksCompanion.insert(
              contentVersion: cv,
              tag: kMapSeedTag,
              manifestSha256: manifestSha,
              installedAt: now,
              state: 'installed',
            ),
          );
      await (_db.delete(_db.mapPackFiles)
            ..where((t) => t.contentVersion.equals(cv)))
          .go();
      await _db.batch((b) => b.insertAll(_db.mapPackFiles, fileRows));

      await _db.customStatement('DELETE FROM $kMapZoneFtsTable');
      for (final r in ftsRows) {
        await _db.customInsert(
          'INSERT INTO $kMapZoneFtsTable '
          '(zone_id, map_id, name, fields_text) VALUES (?, ?, ?, ?)',
          variables: [
            Variable.withString(r.zoneId),
            Variable.withString(r.mapId),
            Variable.withString(r.name),
            Variable.withString(r.fieldsText),
          ],
        );
      }
    });

    return MapSeedImported(mapCount);
  }

  Future<Uint8List> _loadAsset(String key) async {
    final data = await _bundle.load(key);
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  }

  /// Hashes [bytes], offloading large blobs to a background isolate so a big
  /// seed image never janks the UI isolate.
  Future<String> _sha(Uint8List bytes) => bytes.length >= _kIsolateHashThreshold
      ? compute(_hashSeedBytes, bytes)
      : Future.value(sha256Hex(bytes));
}

/// Top-level so it is sendable to a `compute` isolate.
String _hashSeedBytes(Uint8List bytes) => sha256Hex(bytes);

/// The seed importer, wired to the resolved blob store. Async because the store
/// resolves the app-support directory at runtime.
final mapSeedImporterProvider = FutureProvider<MapSeedImporter>((ref) async {
  final store = await ref.watch(mapBlobStoreProvider.future);
  return MapSeedImporter(
    db: ref.watch(appDatabaseProvider),
    store: store,
    prefs: ref.watch(sharedPreferencesProvider),
  );
});

/// Runs the one-time seed import. M1 UI watches this at first Knowledge entry,
/// shows the [MapSeedFailed] empty state (with Retry via `ref.invalidate`) when
/// it fails, and `ref.invalidate(mapsManifestProvider)` once it succeeds so the
/// freshly seeded pack activates (never under the user's feet — §4.7).
final mapSeedImportProvider = FutureProvider<MapSeedOutcome>((ref) async {
  final importer = await ref.watch(mapSeedImporterProvider.future);
  return importer.ensureImported();
});
