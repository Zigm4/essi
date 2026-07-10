import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/celestial/domain/celestial_kind.dart';
import 'package:underdeck_app/features/tools/tracker/data/tracker_client.dart';
import 'package:underdeck_app/features/tools/tracker/domain/tracker_models.dart';

/// R12 — table + fixture tests for the [TrackerClient] resolution ladder and
/// the SBDB path, driven by a fake Dio [HttpClientAdapter] so no real network
/// is touched. Covers `_resolveMPC` / `_normalize` / `_stripParenSuffix` /
/// `_cleanCometForHorizons` and the SBDB status handling (200 single object,
/// HTTP 300 multi-match list, 5xx -> TrackerHttpError, offline ->
/// TrackerOfflineError, 404 -> keep trying then give up).

/// A minimal but real-shaped Horizons VECTORS JSON body: a `result` string that
/// carries one position between the `$$SOE`/`$$EOE` markers.
const _horizonsText = '''
\$\$SOE
2459580.500000000 = A.D. 2022-Jan-01 00:00:00.0000 TDB
 X = 5.000000000000000E+06 Y = 0.000000000000000E+00 Z = 1.000000000000000E+05
 VX= 1.0E+00 VY= 2.0E+00 VZ= 3.0E+00
\$\$EOE
''';

/// Programmable fake adapter. It records every request and answers via
/// [sbdb]/[horizons] callbacks, which may return a [ResponseBody] or throw a
/// [DioException] (e.g. to simulate offline).
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter({this.sbdb, this.horizons});

  final ResponseBody Function(RequestOptions options)? sbdb;
  final ResponseBody Function(RequestOptions options)? horizons;

  final List<RequestOptions> requests = [];

  Iterable<RequestOptions> get sbdbRequests =>
      requests.where((r) => r.path.contains('sbdb'));
  Iterable<RequestOptions> get horizonsRequests =>
      requests.where((r) => r.path.contains('horizons'));

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (options.path.contains('sbdb')) {
      if (sbdb == null) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: options, statusCode: 500),
        );
      }
      return sbdb!(options);
    }
    if (horizons == null) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
      );
    }
    return horizons!(options);
  }
}

ResponseBody _json(Object body, int status) => ResponseBody.fromString(
      body is String ? body : jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

ResponseBody _offline(RequestOptions o) => throw DioException(
      requestOptions: o,
      type: DioExceptionType.connectionError,
    );

TrackerClient _client(_FakeAdapter adapter) {
  final dio = Dio()..httpClientAdapter = adapter;
  return TrackerClient(dio: dio);
}

TrackTarget _target(String name, CelestialKind kind, {String? mpcID}) =>
    TrackTarget(name: name, kind: kind, mpcID: mpcID);

void main() {
  const emptyCatalog = TrackerCatalog([]);

  group('name-cleaning helpers (R12 seams)', () {
    final c = _client(_FakeAdapter());

    test('_normalize trims and unwraps a fully parenthesised name', () {
      expect(c.debugNormalize('  Ceres  '), 'Ceres');
      expect(c.debugNormalize('(433)'), '433');
      expect(c.debugNormalize('(Eros)'), 'Eros');
      expect(c.debugNormalize('Halley'), 'Halley');
      // Only a fully-wrapping pair is unwrapped, not a trailing suffix.
      expect(c.debugNormalize('Halley (1P)'), 'Halley (1P)');
    });

    test('_stripParenSuffix removes only a trailing (…) group', () {
      expect(c.debugStripParenSuffix('Halley (1P)'), 'Halley');
      expect(c.debugStripParenSuffix('Ceres'), 'Ceres');
      expect(c.debugStripParenSuffix('(433) Eros'), '(433) Eros');
    });

    test('_cleanCometForHorizons strips a leading C//P/ and a trailing suffix',
        () {
      expect(c.debugCleanCometForHorizons('C/1995 O1 (Hale-Bopp)'), '1995 O1');
      expect(c.debugCleanCometForHorizons('P/Halley'), 'Halley');
      expect(c.debugCleanCometForHorizons('p/2020 X3 (Comet)'), '2020 X3');
      // No leading designation letter -> only the suffix is trimmed.
      expect(c.debugCleanCometForHorizons('1P (Halley)'), '1P');
    });
  });

  group('resolution ladder', () {
    test('exact-catalog hit resolves with no SBDB network call', () async {
      final adapter = _FakeAdapter(
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      const catalog = TrackerCatalog([
        TrackedObjectEntry(name: 'Ceres', identifier: '1', typeRaw: 'asteroid'),
      ]);
      final result = await _client(adapter).track(
        target: _target('Ceres', CelestialKind.asteroid),
        catalog: catalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '1');
      expect(adapter.sbdbRequests, isEmpty);
      expect(adapter.horizonsRequests, isNotEmpty);
    });

    test('numeric asteroid passes through with no SBDB network call', () async {
      final adapter = _FakeAdapter(
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      final result = await _client(adapter).track(
        target: _target('433', CelestialKind.asteroid),
        catalog: emptyCatalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '433');
      expect(adapter.sbdbRequests, isEmpty);
      // Numeric asteroid COMMAND is suffixed with ';' for Horizons.
      expect(adapter.horizonsRequests.first.queryParameters['COMMAND'],
          "'433;'");
    });

    test('SBDB 200 single object yields its pdes', () async {
      final adapter = _FakeAdapter(
        sbdb: (_) => _json({
          'object': {'pdes': '4'},
        }, 200),
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      final result = await _client(adapter).track(
        target: _target('Vesta', CelestialKind.asteroid),
        catalog: emptyCatalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '4');
      expect(adapter.sbdbRequests.first.queryParameters['sstr'], 'Vesta');
    });

    test('SBDB HTTP 300 multi-match list picks the first candidate', () async {
      final adapter = _FakeAdapter(
        sbdb: (_) => _json({
          'list': [
            {'pdes': '1P', 'name': 'Halley'},
            {'pdes': '2P', 'name': 'Encke'},
          ],
        }, 300),
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      final result = await _client(adapter).track(
        target: _target('Halley', CelestialKind.comet),
        catalog: emptyCatalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '1P');
    });

    test('SBDB 404 falls through attempts, then the stripped-suffix attempt',
        () async {
      final seen = <String>[];
      final adapter = _FakeAdapter(
        sbdb: (o) {
          seen.add(o.queryParameters['sstr'] as String);
          if (o.queryParameters['sstr'] == 'Halley') {
            return _json({
              'object': {'pdes': '1P'},
            }, 200);
          }
          return _json({'code': '404'}, 404);
        },
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      final result = await _client(adapter).track(
        target: _target('Halley (1P)', CelestialKind.comet),
        catalog: emptyCatalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '1P');
      // First the raw name, then the paren-suffix-stripped fallback.
      expect(seen, ['Halley (1P)', 'Halley']);
    });

    test('letters-only name with no SBDB match throws TrackerMpcLookupError',
        () async {
      final adapter = _FakeAdapter(
        sbdb: (_) => _json({'code': '404'}, 404),
      );
      await expectLater(
        _client(adapter).track(
          target: _target('Nonesuch', CelestialKind.asteroid),
          catalog: emptyCatalog,
          cancel: CancelToken(),
        ),
        throwsA(isA<TrackerMpcLookupError>()),
      );
    });

    test('provisional designation (digits+letters) survives an SBDB miss',
        () async {
      final adapter = _FakeAdapter(
        sbdb: (_) => _json({'code': '404'}, 404),
        horizons: (_) => _json({'result': _horizonsText}, 200),
      );
      final result = await _client(adapter).track(
        target: _target('2020 AB', CelestialKind.asteroid),
        catalog: emptyCatalog,
        cancel: CancelToken(),
      );
      expect(result.mpcID, '2020 AB');
    });
  });

  group('SBDB failure surfacing', () {
    test('5xx surfaces TrackerHttpError (not null / "no match")', () async {
      final adapter = _FakeAdapter(
        sbdb: (o) => throw DioException(
          requestOptions: o,
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: o, statusCode: 503),
        ),
      );
      await expectLater(
        _client(adapter).track(
          target: _target('Vesta', CelestialKind.asteroid),
          catalog: emptyCatalog,
          cancel: CancelToken(),
        ),
        throwsA(isA<TrackerHttpError>()
            .having((e) => e.status, 'status', 503)),
      );
    });

    test('offline surfaces TrackerOfflineError', () async {
      final adapter = _FakeAdapter(sbdb: _offline);
      await expectLater(
        _client(adapter).track(
          target: _target('Vesta', CelestialKind.asteroid),
          catalog: emptyCatalog,
          cancel: CancelToken(),
        ),
        throwsA(isA<TrackerOfflineError>()),
      );
    });
  });

  group('Horizons in-band notice surfacing', () {
    test('an "API SERVER BUSY" ephemeris body -> TrackerApiMessageError',
        () async {
      final adapter = _FakeAdapter(
        horizons: (_) => _json({
          'result': 'API SERVER BUSY - no ephemeris generated.',
        }, 200),
      );
      await expectLater(
        _client(adapter).track(
          target: _target('433', CelestialKind.asteroid),
          catalog: emptyCatalog,
          cancel: CancelToken(),
        ),
        throwsA(isA<TrackerApiMessageError>()),
      );
    });
  });
}
