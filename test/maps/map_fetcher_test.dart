import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fetcher.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_integrity.dart';

/// A canned response for a URL: either a body+status or a transport error.
class _Canned {
  final int status;
  final List<int> body;
  final Map<String, List<String>> headers;
  final DioExceptionType? throwType;
  const _Canned({
    this.status = 200,
    this.body = const [],
    this.headers = const {},
    this.throwType,
  });
}

/// Fake adapter that matches a request URL against the first substring key.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.routes);
  final List<MapEntry<String, _Canned>> routes;
  final List<String> hits = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final url = options.uri.toString();
    hits.add(url);
    final match = routes.firstWhere(
      (r) => url.contains(r.key),
      orElse: () => throw StateError('no route for $url'),
    );
    final c = match.value;
    if (c.throwType != null) {
      throw DioException(requestOptions: options, type: c.throwType!);
    }
    return ResponseBody.fromBytes(c.body, c.status, headers: c.headers);
  }

  @override
  void close({bool force = false}) {}
}

Dio _dioWith(_FakeAdapter adapter) {
  final dio = Dio(BaseOptions());
  dio.httpClientAdapter = adapter;
  return dio;
}

void main() {
  group('fetchPointer', () {
    test('304 Not Modified short-circuits', () async {
      final adapter = _FakeAdapter([
        MapEntry(kMapsContentBase, const _Canned(status: 304)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      final result = await fetcher.fetchPointer(etag: 'W/"abc"');
      expect(result.notModified, isTrue);
      expect(result.bytes, isNull);
      // If-None-Match must have been sent.
      expect(adapter.hits, isNotEmpty);
    });

    test('200 returns bytes + etag', () async {
      final body = utf8.encode('{"schemaVersion":1}');
      final adapter = _FakeAdapter([
        MapEntry(
          kMapsContentBase,
          _Canned(
            body: body,
            headers: const {
              'etag': ['W/"v2"'],
            },
          ),
        ),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      final result = await fetcher.fetchPointer();
      expect(result.notModified, isFalse);
      expect(result.bytes, equals(Uint8List.fromList(body)));
      expect(result.etag, 'W/"v2"');
      expect(result.byteLength, body.length);
    });

    test('falls back to raw GitHub when the Pages host errors', () async {
      final body = utf8.encode('{"ok":true}');
      final adapter = _FakeAdapter([
        // Pages host (primary) fails transport.
        const MapEntry(
          'underpunks55.github.io',
          _Canned(throwType: DioExceptionType.connectionError),
        ),
        // raw GitHub (fallback) succeeds.
        MapEntry('raw.githubusercontent.com', _Canned(body: body)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      final result = await fetcher.fetchPointer();
      expect(result.notModified, isFalse);
      expect(result.bytes, equals(Uint8List.fromList(body)));
      expect(
        adapter.hits.any((u) => u.contains('raw.githubusercontent.com')),
        isTrue,
        reason: 'the raw fallback must have been attempted',
      );
    });
  });

  group('fetchVerified', () {
    test('verifies sha256 and returns bytes on match', () async {
      final body = utf8.encode('map-document-bytes');
      final sha = sha256Hex(Uint8List.fromList(body));
      final adapter = _FakeAdapter([
        MapEntry('cdn.jsdelivr.net', _Canned(body: body)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      final bytes = await fetcher.fetchVerified(
        primaryUrl: 'https://cdn.jsdelivr.net/gh/x@t/map.json',
        fallbackUrl: 'https://raw.githubusercontent.com/x/t/map.json',
        expectedSha256: sha,
        maxBytes: 1 << 20,
      );
      expect(bytes, equals(Uint8List.fromList(body)));
    });

    test('rejects a sha256 mismatch (no fallback rescue)', () async {
      final body = utf8.encode('tampered-bytes');
      final adapter = _FakeAdapter([
        MapEntry('cdn.jsdelivr.net', _Canned(body: body)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      await expectLater(
        fetcher.fetchVerified(
          primaryUrl: 'https://cdn.jsdelivr.net/gh/x@t/map.json',
          fallbackUrl: 'https://raw.githubusercontent.com/x/t/map.json',
          expectedSha256: 'deadbeef' * 8, // 64 hex chars, wrong.
          maxBytes: 1 << 20,
        ),
        throwsA(isA<MapFetchIntegrityException>()),
      );
    });

    test('jsDelivr failure falls back to raw, then verifies', () async {
      final body = utf8.encode('same-immutable-bytes');
      final sha = sha256Hex(Uint8List.fromList(body));
      final adapter = _FakeAdapter([
        // jsDelivr 404 (the shared retry does NOT retry 404 → fallback here).
        const MapEntry(
          'cdn.jsdelivr.net',
          _Canned(status: 404),
        ),
        MapEntry('raw.githubusercontent.com', _Canned(body: body)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      final bytes = await fetcher.fetchVerified(
        primaryUrl: 'https://cdn.jsdelivr.net/gh/x@t/map.json',
        fallbackUrl: 'https://raw.githubusercontent.com/x/t/map.json',
        expectedSha256: sha,
        maxBytes: 1 << 20,
      );
      expect(bytes, equals(Uint8List.fromList(body)));
      expect(
        adapter.hits.any((u) => u.contains('raw.githubusercontent.com')),
        isTrue,
      );
    });

    test('rejects an oversized Content-Length before streaming', () async {
      final adapter = _FakeAdapter([
        MapEntry(
          'cdn.jsdelivr.net',
          const _Canned(
            body: [1, 2, 3],
            headers: {
              'content-length': ['999999999'],
            },
          ),
        ),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      await expectLater(
        fetcher.fetchVerified(
          primaryUrl: 'https://cdn.jsdelivr.net/gh/x@t/big.png',
          fallbackUrl: null,
          expectedSha256: 'a' * 64,
          maxBytes: 1024,
        ),
        throwsA(isA<MapTooLargeException>()),
      );
    });

    test('aborts when the streamed body exceeds the cap', () async {
      // No content-length header → the cap is enforced from the stream length.
      final body = List<int>.filled(4096, 7);
      final adapter = _FakeAdapter([
        MapEntry('cdn.jsdelivr.net', _Canned(body: body)),
      ]);
      final fetcher = MapFetcher(_dioWith(adapter));

      await expectLater(
        fetcher.fetchVerified(
          primaryUrl: 'https://cdn.jsdelivr.net/gh/x@t/big.png',
          fallbackUrl: null,
          expectedSha256: 'a' * 64,
          maxBytes: 1024,
        ),
        throwsA(isA<MapTooLargeException>()),
      );
    });
  });
}
