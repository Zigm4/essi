import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/app_dio.dart';
import '../../celestial/domain/celestial_kind.dart';
import '../../scan/data/horizons_client.dart';
import '../domain/tracker_models.dart';

class TrackerClient {
  TrackerClient({required Dio dio}) : _dio = dio;
  final Dio _dio;

  static const _horizonsUrl = 'https://ssd.jpl.nasa.gov/api/horizons.api';
  static const _sbdbUrl = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
  static const _auPerKm = 1.0 / 149597870.7;

  Future<TrackerResult> track({
    required TrackTarget target,
    required TrackerCatalog catalog,
    required CancelToken cancel,
  }) async {
    final mpcID = await _resolveMPC(target, catalog, cancel);
    final today = DateTime.now().toUtc();
    final startOfToday = DateTime.utc(today.year, today.month, today.day);
    final yesterday = startOfToday.subtract(const Duration(days: 1));
    final tomorrow = startOfToday.add(const Duration(days: 1));

    for (final candidate in [startOfToday, yesterday, tomorrow]) {
      final raw = await _fetchHorizonsVectors(
        mpcID: mpcID,
        kind: target.kind,
        date: candidate,
        cancel: cancel,
      );
      if (raw == null) continue;
      final HorizonsRawPosition? first;
      try {
        first = HorizonsParser.firstPosition(raw);
      } on HorizonsFormatException catch (e) {
        // F47 — the payload was not an ephemeris table (e.g. an in-band
        // "API SERVER BUSY" notice); surface it instead of treating it as
        // a missing ephemeris.
        throw TrackerApiMessageError(e.preview);
      }
      if (first == null) continue;
      final date = first.date;
      final x = first.x;
      final y = first.y;
      final z = first.z;

      final xAU = x * _auPerKm;
      final yAU = y * _auPerKm;
      final zAU = z * _auPerKm;
      final distanceAU = math.sqrt(xAU * xAU + yAU * yAU);
      final distanceMiles = (distanceAU / _auPerKm) * 0.621371;
      final slExact = distanceMiles / 3000000.0;
      final slRounded = (slExact * 1000).roundToDouble() / 1000.0;
      final slFloor = slExact.floor();
      final m = HorizonsParser.metrics(x: x, y: y);
      return TrackerResult(
        mpcID: mpcID,
        displayName: target.name,
        kind: target.kind,
        xAU: xAU,
        yAU: yAU,
        zAU: zAU,
        sector: m.sector,
        distanceAU: distanceAU,
        slExact: slExact,
        slRounded: slRounded,
        slFloor: slFloor,
        timestamp: date,
      );
    }
    throw const TrackerNoEphemerisError();
  }

  Future<String> _resolveMPC(
    TrackTarget target,
    TrackerCatalog catalog,
    CancelToken cancel,
  ) async {
    final hint = target.mpcID?.trim();
    if (hint != null && hint.isNotEmpty) return hint;
    final curated = catalog.matchExact(target.name);
    if (curated != null) return curated.identifier;

    final cleaned = _normalize(target.name);
    if (cleaned.isEmpty) throw const TrackerMpcLookupError();
    if (target.kind == CelestialKind.asteroid &&
        RegExp(r'^[0-9]+$').hasMatch(cleaned)) {
      return cleaned;
    }

    final attempts = <String>[cleaned];
    final stripped = _stripParenSuffix(cleaned);
    if (stripped.isNotEmpty && stripped != cleaned) attempts.add(stripped);

    for (final attempt in attempts) {
      final pdes = await _sbdbLookup(attempt, cancel);
      if (pdes != null) return pdes;
    }

    final hasDigit = cleaned.contains(RegExp(r'[0-9]'));
    final hasLetter = cleaned.contains(RegExp(r'[A-Za-z]'));
    if (hasDigit && hasLetter) return cleaned;
    throw const TrackerMpcLookupError();
  }

  String _normalize(String raw) {
    var s = raw.trim();
    if (s.startsWith('(') && s.endsWith(')')) {
      s = s.substring(1, s.length - 1).trim();
    }
    return s;
  }

  String _stripParenSuffix(String raw) {
    return raw.replaceFirst(RegExp(r'\s*\([^()]*\)\s*$'), '').trim();
  }

  String _cleanCometForHorizons(String raw) {
    var s = raw.trim();
    s = s.replaceFirst(RegExp(r'^[CPcp]/'), '');
    s = _stripParenSuffix(s);
    return s.trim();
  }

  Future<String?> _sbdbLookup(String query, CancelToken cancel) async {
    try {
      final response = await _dio.get<dynamic>(
        _sbdbUrl,
        queryParameters: {'sstr': query},
        options: Options(
          responseType: ResponseType.json,
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
          // F18 — SBDB returns HTTP 300 with a `list` body when the query
          // matches multiple objects; accept it so the multi-match branch
          // below can pick a candidate instead of throwing.
          validateStatus: (status) =>
              status != null && status >= 200 && status < 400,
        ),
        cancelToken: cancel,
      );
      final data = response.data;
      Map<String, dynamic>? body;
      if (data is Map<String, dynamic>) {
        body = data;
      } else if (data is String) {
        body = jsonDecode(data) as Map<String, dynamic>;
      }
      if (body == null) return null;
      final obj = body['object'];
      if (obj is Map<String, dynamic>) {
        final pdes = obj['pdes'];
        if (pdes is String && pdes.isNotEmpty) return pdes;
      }
      final list = body['list'];
      if (list is List && list.isNotEmpty) {
        final first = list.first;
        if (first is Map<String, dynamic>) {
          final pdes = first['pdes'];
          if (pdes is String && pdes.isNotEmpty) return pdes;
        }
      }
      return null;
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) throw const TrackerCancelledError();
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const TrackerOfflineError();
      }
      // F18 — a real 404 means "no such object"; keep returning null so the
      // caller can try the next attempt. Any other server response (5xx, or
      // any response at all) is a genuine upstream failure and must surface
      // instead of masquerading as a no-match.
      final status = e.response?.statusCode;
      if (status == 404) return null;
      if (e.response != null) {
        throw TrackerHttpError(status ?? 0);
      }
      return null;
    }
  }

  Future<String?> _fetchHorizonsVectors({
    required String mpcID,
    required CelestialKind kind,
    required DateTime date,
    required CancelToken cancel,
  }) async {
    String two(int n) => n.toString().padLeft(2, '0');
    String fmt(DateTime d) =>
        '${d.year}-${two(d.month)}-${two(d.day)}';
    final start = fmt(date);
    final stop = fmt(date.add(const Duration(days: 1)));

    var commandID = mpcID;
    if (kind == CelestialKind.comet) {
      commandID = _cleanCometForHorizons(commandID);
    }
    if (kind == CelestialKind.asteroid &&
        commandID.isNotEmpty &&
        RegExp(r'^[0-9]+$').hasMatch(commandID)) {
      commandID = '$commandID;';
    }

    final params = {
      'format': 'json',
      'COMMAND': "'$commandID'",
      'OBJ_DATA': "'YES'",
      'MAKE_EPHEM': "'YES'",
      'EPHEM_TYPE': "'VECTORS'",
      'CENTER': "'500@10'",
      'OUT_UNITS': "'KM-S'",
      'START_TIME': "'$start'",
      'STOP_TIME': "'$stop'",
      'STEP_SIZE': "'1d'",
    };

    try {
      final response = await _dio.get<dynamic>(
        _horizonsUrl,
        queryParameters: params,
        options: Options(
          responseType: ResponseType.json,
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
        cancelToken: cancel,
      );
      Map<String, dynamic>? body;
      if (response.data is Map<String, dynamic>) {
        body = response.data as Map<String, dynamic>;
      } else if (response.data is String) {
        body = jsonDecode(response.data as String) as Map<String, dynamic>;
      }
      final text = body?['result'];
      if (text is String && text.isNotEmpty) return text;
      return null;
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) throw const TrackerCancelledError();
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const TrackerOfflineError();
      }
      if (e.response != null) {
        throw TrackerHttpError(e.response!.statusCode ?? 0);
      }
      throw const TrackerUnparseableError();
    }
  }
}

final trackerClientProvider = Provider<TrackerClient>((ref) {
  return TrackerClient(dio: ref.watch(appDioProvider));
});
