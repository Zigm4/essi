import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/app_dio.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

class CelestialClient {
  CelestialClient({required Dio dio}) : _dio = dio;
  final Dio _dio;

  static const _baseUrl = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';

  Future<DiscoverySearchResult> search({
    required DateTime start,
    required DateTime end,
    required CelestialKind kind,
    required CancelToken cancel,
  }) async {
    // The SBDB API filters on calendar dates, so treat the picker values as
    // pure y/m/d and never let the device timezone shift them (F10). Compare
    // against today the same calendar-date way, so "today" is valid in every
    // timezone rather than being rejected east of UTC.
    final now = DateTime.now();
    final todayUtc = DateTime.utc(now.year, now.month, now.day);
    final startUtc = DateTime.utc(start.year, start.month, start.day);
    final endUtc = DateTime.utc(end.year, end.month, end.day);
    if (startUtc.isAfter(endUtc) || endUtc.isAfter(todayUtc)) {
      throw const CelestialDateOutOfRangeError();
    }

    String two(int n) => n.toString().padLeft(2, '0');
    // Format straight from the calendar fields — no .toUtc() shift (F10).
    String fmt(DateTime d) => '${d.year}-${two(d.month)}-${two(d.day)}';
    final startStr = fmt(start);
    final endStr = fmt(end);
    final isHistorical = start.year < 1900;
    final limit = isHistorical ? 50000 : 1000;

    final params = <String, dynamic>{
      'fields': kind == CelestialKind.asteroid
          ? 'full_name,name,kind,pdes,first_obs,last_obs,pha,diameter,albedo'
          : 'full_name,name,kind,pdes,first_obs,last_obs,pha',
      'sb-kind': kind.apiParam,
    };
    if (isHistorical) {
      params['limit'] = '$limit';
    } else {
      params['sb-cdata'] = '{"AND":["first_obs|RG|$startStr|$endStr"]}';
      params['limit'] = '$limit';
    }

    try {
      final response = await _dio.get<dynamic>(
        _baseUrl,
        queryParameters: params,
        options: Options(
          responseType: ResponseType.json,
          sendTimeout: kind == CelestialKind.asteroid
              ? const Duration(seconds: 90)
              : const Duration(seconds: 30),
          receiveTimeout: kind == CelestialKind.asteroid
              ? const Duration(seconds: 90)
              : const Duration(seconds: 30),
        ),
        cancelToken: cancel,
      );
      Map<String, dynamic>? body;
      if (response.data is Map<String, dynamic>) {
        body = response.data as Map<String, dynamic>;
      } else if (response.data is String) {
        body = jsonDecode(response.data as String) as Map<String, dynamic>;
      }
      if (body == null) return const DiscoverySearchResult(objects: []);
      // SBDB caps the reply at `limit` rows with no "there's more" flag, so a
      // reply that exactly fills the limit is almost certainly truncated (F15).
      final returnedRows = (body['data'] as List<dynamic>?)?.length ?? 0;
      final truncated = returnedRows >= limit;
      final raw = _parse(body, kind);
      if (isHistorical) {
        DateTime? parseDate(String? s) {
          if (s == null) return null;
          try {
            return DateTime.parse(s);
          } catch (_) {
            return null;
          }
        }
        final filtered = raw.where((o) {
          final d = parseDate(o.firstObs);
          if (d == null) return false;
          return !d.isBefore(start) && !d.isAfter(end);
        }).toList();
        return DiscoverySearchResult(objects: filtered, truncated: truncated);
      }
      return DiscoverySearchResult(objects: raw, truncated: truncated);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) throw const CelestialCancelledError();
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const CelestialOfflineError();
      }
      if (e.response != null) {
        throw CelestialHttpError(e.response!.statusCode ?? 0);
      }
      throw const CelestialUnparseableError();
    }
  }

  List<DiscoveredObject> _parse(
    Map<String, dynamic> body,
    CelestialKind kind,
  ) {
    final fields = (body['fields'] as List<dynamic>?)?.cast<String>();
    final rows = (body['data'] as List<dynamic>?)
        ?.map((r) => (r as List<dynamic>).toList())
        .toList();
    if (fields == null || rows == null) return const [];

    int? idx(String name) {
      final i = fields.indexOf(name);
      return i < 0 ? null : i;
    }

    final iFullName = idx('full_name');
    final iPdes = idx('pdes');
    final iFirst = idx('first_obs');
    final iLast = idx('last_obs');
    final iPha = idx('pha');
    final iDiameter = idx('diameter');
    final iAlbedo = idx('albedo');

    String? str(List<dynamic> row, int? at) {
      if (at == null || at >= row.length) return null;
      final v = row[at];
      if (v == null) return null;
      if (v is String) return v.isEmpty ? null : v;
      return v.toString();
    }

    double? num_(List<dynamic> row, int? at) {
      if (at == null || at >= row.length) return null;
      final v = row[at];
      if (v == null) return null;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    final out = <DiscoveredObject>[];
    for (final row in rows) {
      final pdes = str(row, iPdes);
      if (pdes == null || pdes.isEmpty) continue;
      // SBDB reports `diameter` in KILOMETRES; convert to metres so the 140 m
      // caution threshold and every "X m" display are correct (F9).
      final diameterKm = num_(row, iDiameter);
      out.add(DiscoveredObject(
        designation: pdes,
        fullName: str(row, iFullName) ?? pdes,
        firstObs: str(row, iFirst),
        lastObs: str(row, iLast),
        isHazardous: str(row, iPha) == 'Y',
        diameterMeters: diameterKm == null ? null : diameterKm * 1000,
        albedo: num_(row, iAlbedo),
        kind: kind,
      ));
    }
    out.sort((a, b) => (a.firstObs ?? '').compareTo(b.firstObs ?? ''));
    return out;
  }
}

final celestialClientProvider = Provider<CelestialClient>((ref) {
  return CelestialClient(dio: ref.watch(appDioProvider));
});
