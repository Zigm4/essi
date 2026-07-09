import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';

import '../domain/scan_models.dart';

/// F47 — thrown when a Horizons payload is not an ephemeris table (the
/// `$$SOE`/`$$EOE` markers are missing), e.g. an in-band "API SERVER BUSY"
/// notice. Carries a short [preview] of the payload so callers can surface it.
class HorizonsFormatException implements Exception {
  final String preview;
  const HorizonsFormatException(this.preview);
  @override
  String toString() => 'HorizonsFormatException: $preview';
}

class HorizonsRawPosition {
  final DateTime date;
  final double x;
  final double y;
  final double z;
  const HorizonsRawPosition(this.date, this.x, this.y, this.z);
}

typedef _RawPosition = HorizonsRawPosition;

class _ScanWindow {
  final double broadDays;
  final String broadStep;
  final double precisionHalfHours;
  final String precisionStep;
  const _ScanWindow({
    required this.broadDays,
    required this.broadStep,
    required this.precisionHalfHours,
    required this.precisionStep,
  });
}

class PlanetMetrics {
  final int sector;
  final int distanceSL;
  const PlanetMetrics({required this.sector, required this.distanceSL});
}

class HorizonsParser {
  HorizonsParser._();

  static const _months = {
    'Jan': 1,
    'Feb': 2,
    'Mar': 3,
    'Apr': 4,
    'May': 5,
    'Jun': 6,
    'Jul': 7,
    'Aug': 8,
    'Sep': 9,
    'Oct': 10,
    'Nov': 11,
    'Dec': 12,
  };

  static DateTime? _parseDate(String s) {
    final parts = s.trim().split(RegExp(r'\s+'));
    if (parts.length < 2) return null;
    final dateParts = parts[0].split('-');
    if (dateParts.length != 3) return null;
    final year = int.tryParse(dateParts[0]);
    final month = _months[dateParts[1]];
    final day = int.tryParse(dateParts[2]);
    if (year == null || month == null || day == null) return null;
    final timeParts = parts[1].split(':');
    if (timeParts.length < 3) return null;
    final hour = int.tryParse(timeParts[0]);
    final minute = int.tryParse(timeParts[1]);
    final secondStr = timeParts[2];
    final secondVal = double.tryParse(secondStr);
    if (hour == null || minute == null || secondVal == null) return null;
    final wholeSec = secondVal.floor();
    final ms = ((secondVal - wholeSec) * 1000).round();
    return DateTime.utc(year, month, day, hour, minute, wholeSec, ms);
  }

  // Tolerant X/Y/Z vector line: handles `X =`, `X=`, extra spaces, and
  // scientific notation. Anchored to the start of the (trimmed) line so it
  // does not accidentally match the velocity line (`VX= ... VY= ... VZ=`).
  static final RegExp _xyzLine = RegExp(
    r'^X\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)'
    r'\s+Y\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)'
    r'\s+Z\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)',
  );

  static List<HorizonsRawPosition> allPositions(String text) {
    // F47 — the ephemeris table lives between the `$$SOE` and `$$EOE`
    // markers. If `$$SOE` is absent the payload is not an ephemeris at all
    // (e.g. "API SERVER BUSY", a rate-limit notice, or an error message);
    // surface it distinctly instead of scanning to an empty list that would
    // collapse into a generic "no data" outcome.
    final soe = text.indexOf(r'$$SOE');
    if (soe < 0) {
      final collapsed = text.trim().replaceAll(RegExp(r'\s+'), ' ');
      final preview =
          collapsed.length > 200 ? collapsed.substring(0, 200) : collapsed;
      throw HorizonsFormatException(preview);
    }
    final eoe = text.indexOf(r'$$EOE', soe);
    final body = eoe < 0
        ? text.substring(soe + 5)
        : text.substring(soe + 5, eoe);

    final out = <_RawPosition>[];
    DateTime? pendingDate;

    for (final raw in const LineSplitter().convert(body)) {
      final line = raw.trim();
      if (line.contains('A.D.')) {
        final after = line.split('A.D.').last.split('TDB').first.trim();
        pendingDate = _parseDate(after);
        continue;
      }
      if (pendingDate == null) continue;
      final m = _xyzLine.firstMatch(line);
      if (m == null) continue;
      final x = double.tryParse(m.group(1)!);
      final y = double.tryParse(m.group(2)!);
      final z = double.tryParse(m.group(3)!);
      if (x == null || y == null || z == null) continue;
      out.add(_RawPosition(pendingDate, x, y, z));
    }
    return out;
  }

  static HorizonsRawPosition? firstPosition(String text) {
    final all = allPositions(text);
    return all.isEmpty ? null : all.first;
  }

  static PlanetMetrics metrics({required double x, required double y}) {
    final distanceKm = math.sqrt(x * x + y * y);
    final distanceMiles = distanceKm * 0.621371;
    final distanceSL = (distanceMiles / 3000000).floor();

    var theta = math.atan2(y, x);
    if (theta < 0) theta += 2 * math.pi;
    final raw = ((theta * 12) / (2 * math.pi)).floor();
    final sector = ((raw + 12) % 12) + 1;

    return PlanetMetrics(sector: sector, distanceSL: distanceSL);
  }
}

class LineSplitter {
  const LineSplitter();
  List<String> convert(String input) => input.split('\n');
}

class HorizonsClient {
  HorizonsClient({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  static const baseUrl = 'https://ssd.jpl.nasa.gov/api/horizons.api';
  static const interRequestDelay = Duration(milliseconds: 200);

  static const planets = <PlanetDef>[
    PlanetDef(name: 'Mercury', code: '199', emoji: '☿'),
    PlanetDef(name: 'Venus', code: '299', emoji: '♀'),
    PlanetDef(name: 'Earth', code: '399', emoji: '\u{1F30D}'),
    PlanetDef(name: 'Mars', code: '499', emoji: '♂'),
    PlanetDef(name: 'Jupiter', code: '599', emoji: '♃'),
    PlanetDef(name: 'Saturn', code: '699', emoji: '♄'),
    PlanetDef(name: 'Uranus', code: '799', emoji: '♅'),
    PlanetDef(name: 'Neptune', code: '899', emoji: '♆'),
    PlanetDef(name: 'Pluto', code: '999', emoji: '♇'),
  ];

  static _ScanWindow _windowFor(String name) {
    switch (name) {
      case 'Mercury':
      case 'Venus':
      case 'Earth':
      case 'Mars':
        return const _ScanWindow(
          broadDays: 60,
          broadStep: '1h',
          precisionHalfHours: 12,
          precisionStep: '1m',
        );
      case 'Jupiter':
        return const _ScanWindow(
          broadDays: 540,
          broadStep: '12h',
          precisionHalfHours: 18,
          precisionStep: '5m',
        );
      case 'Saturn':
        return const _ScanWindow(
          broadDays: 4 * 365,
          broadStep: '1d',
          precisionHalfHours: 48,
          precisionStep: '30m',
        );
      case 'Uranus':
        return const _ScanWindow(
          broadDays: 10 * 365,
          broadStep: '2d',
          precisionHalfHours: 72,
          precisionStep: '1h',
        );
      case 'Neptune':
        return const _ScanWindow(
          broadDays: 20 * 365,
          broadStep: '7d',
          precisionHalfHours: 240,
          precisionStep: '6h',
        );
      case 'Pluto':
        return const _ScanWindow(
          broadDays: 30 * 365,
          broadStep: '14d',
          precisionHalfHours: 480,
          precisionStep: '12h',
        );
      default:
        return const _ScanWindow(
          broadDays: 60,
          broadStep: '1h',
          precisionHalfHours: 12,
          precisionStep: '1m',
        );
    }
  }

  static String _formatUtc(DateTime d) {
    final u = d.toUtc();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${u.year.toString().padLeft(4, '0')}-${two(u.month)}-${two(u.day)} ${two(u.hour)}:${two(u.minute)}';
  }

  Future<String> _fetchText({
    required String code,
    required DateTime start,
    required DateTime stop,
    required String step,
    required CancelToken cancel,
  }) async {
    final params = {
      'format': 'text',
      'COMMAND': "'$code'",
      'OBJ_DATA': "'NO'",
      'MAKE_EPHEM': "'YES'",
      'EPHEM_TYPE': "'VECTORS'",
      'CENTER': "'500@10'",
      'OUT_UNITS': "'KM-S'",
      'START_TIME': "'${_formatUtc(start)}'",
      'STOP_TIME': "'${_formatUtc(stop)}'",
      'STEP_SIZE': "'$step'",
      'QUANTITIES': "'1'",
    };
    try {
      final response = await _dio.get<String>(
        baseUrl,
        queryParameters: params,
        options: Options(
          responseType: ResponseType.plain,
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
        cancelToken: cancel,
      );
      if (response.statusCode != 200) {
        throw ScanHttpError(response.statusCode ?? 0);
      }
      return response.data ?? '';
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        throw const ScanCancelledError();
      }
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const ScanOfflineError();
      }
      if (e.response != null) {
        throw ScanHttpError(e.response!.statusCode ?? 0);
      }
      throw const ScanUnparseableError();
    }
  }

  Future<PlanetPosition> fetchLight({
    required PlanetDef planet,
    required CancelToken cancel,
  }) async {
    final now = DateTime.now().toUtc();
    final text = await _fetchText(
      code: planet.code,
      start: now,
      stop: now.add(const Duration(hours: 1)),
      step: '1h',
      cancel: cancel,
    );
    final HorizonsRawPosition? raw;
    try {
      raw = HorizonsParser.firstPosition(text);
    } on HorizonsFormatException catch (e) {
      throw ScanApiMessageError(e.preview);
    }
    if (raw == null) throw const ScanNoDataError();
    final m = HorizonsParser.metrics(x: raw.x, y: raw.y);
    return PlanetPosition(
      name: planet.name,
      emoji: planet.emoji,
      sector: m.sector,
      distanceSL: m.distanceSL,
      timestamp: raw.date,
    );
  }

  Future<PlanetPosition> fetchFull({
    required PlanetDef planet,
    required CancelToken cancel,
  }) async {
    final cfg = _windowFor(planet.name);
    final now = DateTime.now().toUtc();
    final later = now.add(Duration(seconds: (cfg.broadDays * 24 * 3600).round()));
    final text = await _fetchText(
      code: planet.code,
      start: now,
      stop: later,
      step: cfg.broadStep,
      cancel: cancel,
    );
    final List<HorizonsRawPosition> positions;
    try {
      positions = HorizonsParser.allPositions(text);
    } on HorizonsFormatException catch (e) {
      throw ScanApiMessageError(e.preview);
    }
    if (positions.isEmpty) throw const ScanNoDataError();
    final firstMetrics = HorizonsParser.metrics(
      x: positions.first.x,
      y: positions.first.y,
    );

    DateTime? rough;
    int? nextSectorRaw;
    var prev = firstMetrics.sector;
    for (var i = 1; i < positions.length; i++) {
      final m = HorizonsParser.metrics(
        x: positions[i].x,
        y: positions[i].y,
      );
      if (m.sector != prev) {
        rough = positions[i].date;
        nextSectorRaw = m.sector;
        break;
      }
      prev = m.sector;
    }

    NextSectorChange? precise;
    if (rough != null && nextSectorRaw != null) {
      await Future<void>.delayed(interRequestDelay);
      final halfWindow = Duration(seconds: (cfg.precisionHalfHours * 3600).round());
      final preStart = rough.subtract(halfWindow);
      final preStop = rough.add(halfWindow);
      try {
        final preText = await _fetchText(
          code: planet.code,
          start: preStart,
          stop: preStop,
          step: cfg.precisionStep,
          cancel: cancel,
        );
        final preList = HorizonsParser.allPositions(preText);
        if (preList.isNotEmpty) {
          var prev2 = HorizonsParser.metrics(
            x: preList[0].x,
            y: preList[0].y,
          ).sector;
          for (var i = 1; i < preList.length; i++) {
            final m = HorizonsParser.metrics(
              x: preList[i].x,
              y: preList[i].y,
            );
            if (m.sector != prev2) {
              precise = NextSectorChange(
                date: preList[i].date,
                toSector: m.sector,
              );
              break;
            }
            prev2 = m.sector;
          }
        }
      } catch (_) {
        // precision call failed, fall back to rough
      }
      precise ??= NextSectorChange(date: rough, toSector: nextSectorRaw);
    }

    return PlanetPosition(
      name: planet.name,
      emoji: planet.emoji,
      sector: firstMetrics.sector,
      distanceSL: firstMetrics.distanceSL,
      timestamp: positions.first.date,
      nextChange: precise,
    );
  }
}

class PlanetDef {
  final String name;
  final String code;
  final String emoji;
  const PlanetDef({
    required this.name,
    required this.code,
    required this.emoji,
  });
}
