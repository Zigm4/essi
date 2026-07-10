import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:underdeck_app/features/knowledge/maps/data/map_blob_store.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_integrity.dart';

void main() {
  late Directory tmp;
  late MapBlobStore store;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('blobstore_test');
    store = MapBlobStore(Directory(p.join(tmp.path, 'maps_store', 'blobs')));
  });

  tearDown(() async {
    if (await tmp.exists()) await tmp.delete(recursive: true);
  });

  Uint8List bytesOf(String s) => Uint8List.fromList(s.codeUnits);

  test('write verifies sha then stores at content address; read round-trips',
      () async {
    final data = bytesOf('hello-map');
    final sha = sha256Hex(data);

    expect(await store.exists(sha), isFalse);
    final file = await store.write(data, sha);

    expect(p.basename(file.path), sha, reason: 'filename IS the sha256');
    expect(await store.exists(sha), isTrue);
    expect(await store.read(sha), equals(data));
  });

  test('write throws on sha mismatch and writes nothing', () async {
    final data = bytesOf('genuine');
    const wrongSha =
        '0000000000000000000000000000000000000000000000000000000000000000';

    await expectLater(
      store.write(data, wrongSha),
      throwsA(isA<BlobIntegrityException>()),
    );
    expect(await store.exists(wrongSha), isFalse);
    // No temp files left behind either.
    final dir = store.blobsDir;
    final leftovers = await dir.exists()
        ? await dir.list().toList()
        : const <FileSystemEntity>[];
    expect(leftovers, isEmpty);
  });

  test('write is idempotent for an already-present blob', () async {
    final data = bytesOf('dedup-me');
    final sha = sha256Hex(data);

    final first = await store.write(data, sha);
    final firstModified = (await first.stat()).modified;
    // Second write of identical content must be a no-op (same file returned).
    final second = await store.write(data, sha);
    expect(second.path, first.path);
    expect((await second.stat()).modified, firstModified);
  });

  test('read returns null for a missing blob', () async {
    expect(await store.read('f' * 64), isNull);
  });

  test('gc deletes only blobs not in the keep set', () async {
    final a = bytesOf('alpha');
    final b = bytesOf('bravo');
    final c = bytesOf('charlie');
    final shaA = sha256Hex(a);
    final shaB = sha256Hex(b);
    final shaC = sha256Hex(c);
    await store.write(a, shaA);
    await store.write(b, shaB);
    await store.write(c, shaC);

    // Keep A (referenced) and C (pinned); B is orphaned.
    final deleted = await store.gc(keep: {shaA, shaC});
    expect(deleted, 1);
    expect(await store.exists(shaA), isTrue);
    expect(await store.exists(shaB), isFalse);
    expect(await store.exists(shaC), isTrue);
  });

  test('gc on an empty/absent store is a safe no-op', () async {
    expect(await store.gc(keep: const {}), 0);
  });
}
