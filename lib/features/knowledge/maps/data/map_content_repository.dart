import 'dart:convert';

import 'package:collection/collection.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/logging.dart';
import '../../../../data/database/app_database.dart';
import '../../../../services/app_settings.dart';
import '../domain/map_models.dart';
import '../domain/map_validator.dart';
import 'map_blob_store.dart';
import 'map_fetcher.dart';
import 'map_fts_index.dart';

/// The content repository the owner points the app at. jsDelivr and raw-GitHub
/// URLs are both derived from this `owner/repo` slug plus the pointer's tag.
const String kMapsContentRepo = 'underpunks55/underdeck-content';

/// jsDelivr (tag-pinned, immutable, no rate limit) URL for a repo-relative path.
String mapsJsDelivrUrl(String tag, String path) =>
    'https://cdn.jsdelivr.net/gh/$kMapsContentRepo@$tag/$path';

/// raw.githubusercontent.com fallback URL for a repo-relative path at a tag.
String mapsRawUrl(String tag, String path) =>
    'https://raw.githubusercontent.com/$kMapsContentRepo/$tag/$path';

/// Compares two dotted numeric version strings (semver-ish). Non-numeric or
/// missing components sort low. Returns <0, 0, >0.
int compareContentVersions(String a, String b) {
  final pa = a.split(RegExp(r'[.\-+]'));
  final pb = b.split(RegExp(r'[.\-+]'));
  final n = pa.length > pb.length ? pa.length : pb.length;
  for (var i = 0; i < n; i++) {
    final va = i < pa.length ? int.tryParse(pa[i]) ?? 0 : 0;
    final vb = i < pb.length ? int.tryParse(pb[i]) ?? 0 : 0;
    if (va != vb) return va < vb ? -1 : 1;
  }
  return 0;
}

/// Raised when an install cannot complete (a document failed validation, a
/// blob could not be fetched/verified). The transaction is not committed, so
/// the previously installed pack stays intact.
class MapInstallException implements Exception {
  final String message;
  const MapInstallException(this.message);
  @override
  String toString() => 'MapInstallException: $message';
}

/// The result of [MapContentRepository.checkForUpdate].
sealed class MapUpdateOutcome {
  const MapUpdateOutcome();
}

/// Maps network access is disabled in settings.
class MapUpdateDisabled extends MapUpdateOutcome {
  const MapUpdateDisabled();
}

/// The ≤1/24h throttle window has not elapsed and `force` was not set.
class MapUpdateThrottled extends MapUpdateOutcome {
  const MapUpdateThrottled();
}

/// No newer content (304, or the pointer's version is not greater than what is
/// installed — anti-rollback also lands here).
class MapUpToDate extends MapUpdateOutcome {
  const MapUpToDate();
}

/// The pointer requires a newer app than this build (gate on `minAppVersion`).
class MapUpdateBlockedByAppVersion extends MapUpdateOutcome {
  final String minAppVersion;
  const MapUpdateBlockedByAppVersion(this.minAppVersion);
}

/// The check failed (transport, malformed/oversized content). Local content is
/// untouched.
class MapUpdateCheckFailed extends MapUpdateOutcome {
  final Object error;
  const MapUpdateCheckFailed(this.error);
}

/// A newer, validated pointer + manifest is available to [install].
class MapUpdateAvailable extends MapUpdateOutcome {
  final MapsPointer pointer;
  final MapsManifest manifest;
  final Uint8List manifestBytes;
  const MapUpdateAvailable(this.pointer, this.manifest, this.manifestBytes);
}

/// Orchestrates the content lifecycle: throttled update checks, differential
/// install into the blob store + Drift index, and offline reads. All render
/// reads come from the store — never the network (AUDIT-V2 §4.7).
class MapContentRepository {
  final AppDatabase _db;
  final MapBlobStore _store;
  final MapFetcher _fetcher;
  final SharedPreferences _prefs;
  final MapContentValidator _validator;

  MapContentRepository({
    required AppDatabase db,
    required MapBlobStore store,
    required MapFetcher fetcher,
    required SharedPreferences prefs,
    MapContentValidator validator = const MapContentValidator(),
  })  : _db = db,
        _store = store,
        _fetcher = fetcher,
        _prefs = prefs,
        _validator = validator;

  static const _kEtag = 'maps.pointerEtag';
  static const _kLastCheckAt = 'maps.lastCheckAt';
  static const Duration checkInterval = Duration(hours: 24);

  // --- update check ----------------------------------------------------------

  /// Fetches the pointer (throttled ≤1/24h), validates it, gates on
  /// `minAppVersion`, applies anti-rollback, and — when a newer version is
  /// available — fetches and validates the manifest. Never throws: transport /
  /// parse failures surface as [MapUpdateCheckFailed].
  Future<MapUpdateOutcome> checkForUpdate({
    required bool networkEnabled,
    required String appVersion,
    bool force = false,
    DateTime? now,
  }) async {
    if (!networkEnabled) return const MapUpdateDisabled();
    final at = now ?? DateTime.now();

    if (!force) {
      final lastMs = _prefs.getInt(_kLastCheckAt);
      if (lastMs != null) {
        final last = DateTime.fromMillisecondsSinceEpoch(lastMs);
        if (at.difference(last) < checkInterval) {
          return const MapUpdateThrottled();
        }
      }
    }

    try {
      final etag = _prefs.getString(_kEtag);
      final pr = await _fetcher.fetchPointer(etag: etag);
      // The check ran; record the timestamp regardless of the result.
      await _prefs.setInt(_kLastCheckAt, at.millisecondsSinceEpoch);

      if (pr.notModified) return const MapUpToDate();

      final pointerRes = _validator.validatePointer(
        _decodeJson(pr.bytes!),
        byteLength: pr.byteLength,
      );
      if (pointerRes is! MapParseOk<MapsPointer>) {
        return MapUpdateCheckFailed(pointerRes as MapParseError<MapsPointer>);
      }
      final pointer = pointerRes.value;

      // Anti-rollback + "already have it": refuse anything not strictly newer
      // than the installed version.
      final installed = await installedContentVersion();
      if (installed != null &&
          compareContentVersions(pointer.contentVersion, installed) <= 0) {
        // Persist the new ETag so the next poll can 304 cheaply.
        if (pr.etag != null) await _prefs.setString(_kEtag, pr.etag!);
        return const MapUpToDate();
      }

      // App-version gate.
      if (compareContentVersions(appVersion, pointer.minAppVersion) < 0) {
        return MapUpdateBlockedByAppVersion(pointer.minAppVersion);
      }

      // Fetch + validate the manifest.
      final manifestBytes = await _fetcher.fetchVerified(
        primaryUrl: mapsJsDelivrUrl(pointer.tag, pointer.manifest.path),
        fallbackUrl: mapsRawUrl(pointer.tag, pointer.manifest.path),
        expectedSha256: pointer.manifest.sha256,
        maxBytes: MapLimits.manifestMaxBytes,
      );
      final manifestRes = _validator.validateManifest(
        _decodeJson(manifestBytes),
        byteLength: manifestBytes.length,
      );
      if (manifestRes is! MapParseOk<MapsManifest>) {
        return MapUpdateCheckFailed(
          manifestRes as MapParseError<MapsManifest>,
        );
      }

      // Only persist the ETag once the whole chain validated, so a partial
      // failure re-fetches next time rather than 304-ing into a broken state.
      if (pr.etag != null) await _prefs.setString(_kEtag, pr.etag!);
      return MapUpdateAvailable(pointer, manifestRes.value, manifestBytes);
    } catch (e, s) {
      logError(e, s);
      return MapUpdateCheckFailed(e);
    }
  }

  // --- install ---------------------------------------------------------------

  /// Installs the content described by [available]: fetches every non-draft
  /// map's document + assets (skipping any blob already present — differential
  /// reuse by sha256), verifies each, then commits the pack index + FTS rebuild
  /// transactionally and GCs orphaned blobs. On any failure the previous pack
  /// stays installed.
  ///
  /// [pins] are sha256s that must survive GC regardless of references (blobs of
  /// a currently-open document).
  Future<void> install(
    MapUpdateAvailable available, {
    Set<String> pins = const {},
    DateTime? now,
  }) async {
    final pointer = available.pointer;
    final manifest = available.manifest;
    final tag = pointer.tag;
    final cv = manifest.contentVersion;
    final at = now ?? DateTime.now();

    // Store the manifest blob (verified by the pointer's pinned hash).
    await _store.write(available.manifestBytes, pointer.manifest.sha256);

    final files = <MapPackFilesCompanion>[
      MapPackFilesCompanion.insert(
        contentVersion: cv,
        logicalPath: 'manifest.json',
        sha256: pointer.manifest.sha256,
        bytes: pointer.manifest.bytes,
        kind: const Value('manifest'),
      ),
    ];
    final ftsRows = <ZoneFtsRow>[];

    for (final d in manifest.maps) {
      if (d.draft) continue;

      // Document.
      final docBytes = await _ensureBlob(
        tag: tag,
        cdnBase: manifest.cdnBase,
        path: d.document.path,
        sha256: d.document.sha256,
        maxBytes: MapLimits.documentMaxBytes,
      );
      final docRes = _validator.validateDocument(
        _decodeJson(docBytes),
        byteLength: docBytes.length,
      );
      if (docRes is! MapParseOk<MapDocument>) {
        throw MapInstallException('map ${d.id}: invalid document ($docRes)');
      }
      files.add(
        MapPackFilesCompanion.insert(
          contentVersion: cv,
          logicalPath: d.document.path,
          sha256: d.document.sha256,
          bytes: d.document.bytes,
          kind: const Value('document'),
        ),
      );
      ftsRows.addAll(buildZoneFtsRows(docRes.value));

      // Assets.
      for (final a in d.assets) {
        await _ensureBlob(
          tag: tag,
          cdnBase: manifest.cdnBase,
          path: a.path,
          sha256: a.sha256,
          maxBytes: MapLimits.maxImageBytes,
        );
        files.add(
          MapPackFilesCompanion.insert(
            contentVersion: cv,
            logicalPath: a.path,
            sha256: a.sha256,
            bytes: a.bytes,
            kind: Value(a.kind ?? 'asset'),
          ),
        );
      }
    }

    // Transactional commit: pack row + file index + FTS rebuild.
    await _db.transaction(() async {
      await _db.into(_db.mapPacks).insertOnConflictUpdate(
            MapPacksCompanion.insert(
              contentVersion: cv,
              tag: tag,
              manifestSha256: pointer.manifest.sha256,
              installedAt: at,
              state: 'installed',
            ),
          );
      await (_db.delete(_db.mapPackFiles)
            ..where((t) => t.contentVersion.equals(cv)))
          .go();
      await _db.batch((b) => b.insertAll(_db.mapPackFiles, files));

      // FTS is a single-installed-version index: clear and repopulate.
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

    await gc(pins: pins);
  }

  /// Fetches (or reuses) a blob and returns its bytes. If the blob is already
  /// on disk it is trusted by content address and returned without a network
  /// hit — this is the differential-reuse fast path.
  Future<Uint8List> _ensureBlob({
    required String tag,
    required String cdnBase,
    required String path,
    required String sha256,
    required int maxBytes,
  }) async {
    final existing = await _store.read(sha256);
    if (existing != null) return existing;
    final bytes = await _fetcher.fetchVerified(
      primaryUrl: '$cdnBase/$path',
      fallbackUrl: mapsRawUrl(tag, path),
      expectedSha256: sha256,
      maxBytes: maxBytes,
    );
    await _store.write(bytes, sha256);
    return bytes;
  }

  // --- offline reads ---------------------------------------------------------

  /// The content version of the currently installed pack, or `null`.
  Future<String?> installedContentVersion() async {
    final pack = await _installedPack();
    return pack?.contentVersion;
  }

  /// Loads + validates the installed manifest from the blob store, or `null` if
  /// nothing is installed / the blob is missing / it no longer validates.
  Future<MapsManifest?> loadInstalledManifest() async {
    final pack = await _installedPack();
    if (pack == null) return null;
    final bytes = await _store.read(pack.manifestSha256);
    if (bytes == null) return null;
    final res = _validator.validateManifest(
      _decodeJson(bytes),
      byteLength: bytes.length,
    );
    return res.valueOrNull;
  }

  /// Loads + validates a single map document by id from the store, or `null`.
  Future<MapDocument?> loadDocument(String mapId) async {
    final manifest = await loadInstalledManifest();
    final d = manifest?.maps.firstWhereOrNull((m) => m.id == mapId);
    if (d == null) return null;
    final bytes = await _store.read(d.document.sha256);
    if (bytes == null) return null;
    final res = _validator.validateDocument(
      _decodeJson(bytes),
      byteLength: bytes.length,
    );
    return res.valueOrNull;
  }

  /// Loads the bytes of a map's asset by role [kind] (e.g. `'background'`) from
  /// the offline store, or `null` if the map/asset/blob is missing. Render-time
  /// reads go through here — never the network (AUDIT-V2 §4.7).
  Future<Uint8List?> loadMapAssetBytes(
    String mapId, {
    required String kind,
  }) async {
    final manifest = await loadInstalledManifest();
    final d = manifest?.maps.firstWhereOrNull((m) => m.id == mapId);
    if (d == null) return null;
    final asset = d.assets.firstWhereOrNull((a) => a.kind == kind);
    if (asset == null) return null;
    return _store.read(asset.sha256);
  }

  Future<MapPack?> _installedPack() {
    return (_db.select(_db.mapPacks)
          ..where((t) => t.state.equals('installed'))
          ..orderBy([(t) => OrderingTerm.desc(t.installedAt)])
          ..limit(1))
        .getSingleOrNull();
  }

  // --- gc --------------------------------------------------------------------

  /// Deletes blobs not referenced by any installed pack (nor [pins]). Operates
  /// only on local `MapPacks`/`MapPackFiles` rows — never on server state.
  Future<int> gc({Set<String> pins = const {}}) async {
    final packs = await (_db.select(_db.mapPacks)
          ..where((t) => t.state.equals('installed')))
        .get();
    final keep = <String>{...pins};
    for (final pk in packs) {
      keep.add(pk.manifestSha256);
    }
    final fileRows = await _db.select(_db.mapPackFiles).get();
    for (final f in fileRows) {
      keep.add(f.sha256);
    }
    return _store.gc(keep: keep);
  }

  // --- management (Settings › Downloaded maps) -------------------------------

  /// Total on-disk size (bytes) of the offline blob store. Drives the
  /// "Downloaded maps: X" figure in Settings.
  Future<int> storeSizeBytes() => _store.totalBytes();

  /// Wipes ALL locally installed map content: every `MapPacks`/`MapPackFiles`
  /// row, the FTS index, and every blob on disk. Also forgets the pointer ETag
  /// and the last-check timestamp so the next check re-fetches cleanly. Only
  /// touches local state — never server state.
  ///
  /// The bundled seed is NOT re-imported here (the seed-imported flag lives in
  /// the importer's namespace); callers that want the seed baseline back should
  /// reset [kMapSeedImportedPref] and re-run the import provider afterwards.
  Future<void> clearAllContent() async {
    await _db.transaction(() async {
      await _db.delete(_db.mapPackFiles).go();
      await _db.delete(_db.mapPacks).go();
      await _db.customStatement('DELETE FROM $kMapZoneFtsTable');
    });
    // No packs/files remain, so keep is empty → every blob is collected.
    await gc();
    await _prefs.remove(_kEtag);
    await _prefs.remove(_kLastCheckAt);
  }

  Map<String, dynamic> _decodeJson(Uint8List bytes) =>
      jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
}

/// Async because it depends on the resolved [mapBlobStoreProvider].
final mapContentRepositoryProvider =
    FutureProvider<MapContentRepository>((ref) async {
  final store = await ref.watch(mapBlobStoreProvider.future);
  return MapContentRepository(
    db: ref.watch(appDatabaseProvider),
    store: store,
    fetcher: ref.watch(mapFetcherProvider),
    prefs: ref.watch(sharedPreferencesProvider),
  );
});

/// The installed manifest, read from the store. Ref-invalidatable: activate a
/// freshly installed pack by `ref.invalidate(mapsManifestProvider)` at screen
/// entry (NOT under the user's feet — AUDIT-V2 §4.7).
final mapsManifestProvider = FutureProvider<MapsManifest?>((ref) async {
  final repo = await ref.watch(mapContentRepositoryProvider.future);
  return repo.loadInstalledManifest();
});

/// A single installed map document by id, read from the store. Ref-invalidatable
/// per-id via `ref.invalidate(mapDocumentProvider(id))`.
final mapDocumentProvider =
    FutureProvider.family<MapDocument?, String>((ref, id) async {
  final repo = await ref.watch(mapContentRepositoryProvider.future);
  return repo.loadDocument(id);
});

/// The raw (undecoded) background image bytes for a flat map, read from the
/// offline store. `null` when the map has no `background` asset installed. The
/// render layer decodes these at a constrained size (never at intrinsic
/// resolution — AUDIT-V2 §4.7 / M1).
final mapBackgroundBytesProvider =
    FutureProvider.family<Uint8List?, String>((ref, mapId) async {
  final repo = await ref.watch(mapContentRepositoryProvider.future);
  return repo.loadMapAssetBytes(mapId, kind: 'background');
});

/// On-disk size of the offline blob store, in bytes. Ref-invalidatable so the
/// Settings management row can refresh after a clear. Returns 0 on any error so
/// the UI never blocks on it.
final mapsStoreSizeProvider = FutureProvider<int>((ref) async {
  final repo = await ref.watch(mapContentRepositoryProvider.future);
  return repo.storeSizeBytes();
});
