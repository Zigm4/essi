import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../domain/map_integrity.dart';

/// Thrown by [MapBlobStore.write] when the bytes handed in do not hash to the
/// expected sha256. The blob is never written in this case.
class BlobIntegrityException implements Exception {
  final String expectedSha256;
  const BlobIntegrityException(this.expectedSha256);

  @override
  String toString() =>
      'BlobIntegrityException: bytes do not match sha256 $expectedSha256';
}

/// Content-addressed, offline blob store for map documents and image assets.
///
/// Files live at `<appSupport>/maps_store/blobs/<sha256>`. The store is the
/// single source of truth for the render layer — nothing reads from the network
/// at render time (AUDIT-V2 §4.7).
///
/// Invariants:
/// - a blob is only written AFTER its sha256 is verified, and atomically
///   (`.tmp` + rename) so a crash mid-write never leaves a half-file at the
///   final content address;
/// - because the filename *is* the sha256, an already-present blob is trusted
///   and re-writing is a no-op (free differential reuse across content
///   versions).
class MapBlobStore {
  /// The `blobs` directory (its parents may not exist yet).
  final Directory blobsDir;

  MapBlobStore(this.blobsDir);

  /// Resolves the production location under the app-support directory.
  static Future<MapBlobStore> open() async {
    final support = await getApplicationSupportDirectory();
    return MapBlobStore(
      Directory(p.join(support.path, 'maps_store', 'blobs')),
    );
  }

  /// The on-disk path a blob with [sha256] would occupy (may not exist).
  File fileFor(String sha256) => File(p.join(blobsDir.path, sha256));

  /// Whether a blob with [sha256] is present on disk.
  Future<bool> exists(String sha256) => fileFor(sha256).exists();

  /// Reads a blob's bytes, or `null` if it is not present.
  Future<Uint8List?> read(String sha256) async {
    final f = fileFor(sha256);
    if (!await f.exists()) return null;
    return f.readAsBytes();
  }

  /// Verifies [bytes] hash to [expectedSha256], then writes them atomically at
  /// that content address and returns the file. If the blob already exists the
  /// write is skipped (still verified-by-address). Throws
  /// [BlobIntegrityException] on a hash mismatch — nothing is written.
  Future<File> write(Uint8List bytes, String expectedSha256) async {
    if (!verifyBytes(bytes, expectedSha256)) {
      throw BlobIntegrityException(expectedSha256);
    }
    return _writeAtomic(bytes, expectedSha256);
  }

  /// Writes [bytes] at content address [sha256] WITHOUT re-verifying the hash.
  ///
  /// Only for callers that have *already* computed [sha256] over exactly these
  /// bytes from a trusted, in-process source (the bundled seed pack, authored
  /// and signed as part of the app binary — AUDIT-V2 §4.7). Skipping the second
  /// hash keeps a large seed asset off the critical path when the caller has
  /// already hashed it (e.g. on a background isolate). For anything crossing the
  /// network use [write], which verifies.
  Future<File> writeTrusted(Uint8List bytes, String sha256) =>
      _writeAtomic(bytes, sha256);

  Future<File> _writeAtomic(Uint8List bytes, String sha256) async {
    final normalized = sha256.trim().toLowerCase();
    final target = fileFor(normalized);
    if (await target.exists()) return target;

    await blobsDir.create(recursive: true);
    // Unique temp name so two concurrent writers of *different* blobs never
    // collide on the temp path.
    final tmp = File(
      '${target.path}.tmp.$pid.${DateTime.now().microsecondsSinceEpoch}',
    );
    await tmp.writeAsBytes(bytes, flush: true);
    try {
      // rename is atomic within a filesystem; a racing writer that already
      // produced the final file makes this the winner-takes-all no-op below.
      return await tmp.rename(target.path);
    } on FileSystemException {
      // Lost the race (target now exists) — drop our temp, trust the winner.
      if (await target.exists()) {
        await _deleteQuietly(tmp);
        return target;
      }
      rethrow;
    }
  }

  /// Deletes every blob whose sha256 is NOT in [keep], returning the number of
  /// files removed. [keep] must be the union of the sha256s referenced by all
  /// *locally installed* `MapPacks` rows and the caller's pin set (blobs of any
  /// currently-open document). This only ever operates on local state — never
  /// on server state — and never deletes a pinned blob (AUDIT-V2 §4.7).
  ///
  /// Any file not in [keep] (including stale `.tmp` leftovers) is collected.
  Future<int> gc({required Set<String> keep}) async {
    if (!await blobsDir.exists()) return 0;
    var deleted = 0;
    await for (final entity in blobsDir.list(followLinks: false)) {
      if (entity is! File) continue;
      final name = p.basename(entity.path);
      if (keep.contains(name)) continue;
      await _deleteQuietly(entity);
      deleted++;
    }
    return deleted;
  }

  /// Total size on disk (bytes) of every blob currently stored. Best-effort:
  /// a file vanishing mid-scan (concurrent GC) is skipped rather than thrown.
  /// Drives the "Downloaded maps: X" management affordance in Settings.
  Future<int> totalBytes() async {
    if (!await blobsDir.exists()) return 0;
    var total = 0;
    await for (final entity in blobsDir.list(followLinks: false)) {
      if (entity is! File) continue;
      try {
        total += await entity.length();
      } on FileSystemException {
        // File removed between listing and stat — ignore.
      }
    }
    return total;
  }

  Future<void> _deleteQuietly(File f) async {
    try {
      if (await f.exists()) await f.delete();
    } on FileSystemException {
      // Best-effort: a concurrent deleter winning is fine.
    }
  }
}

/// App-wide blob store. Async because the app-support directory is resolved at
/// runtime; consumers `await ref.watch(mapBlobStoreProvider.future)`.
final mapBlobStoreProvider = FutureProvider<MapBlobStore>((ref) {
  return MapBlobStore.open();
});
