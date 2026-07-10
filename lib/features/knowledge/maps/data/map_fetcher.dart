import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/app_dio.dart';
import '../domain/map_integrity.dart';
import '../domain/map_validator.dart';

/// Base URL of the mutable content pointer, served from GitHub Pages. The owner
/// re-points this host at the real content org; the path shape is fixed.
///
/// Rule of thumb (AUDIT-V2 §4.1): everything mutable is tiny and lives here;
/// everything large is immutable and lives on jsDelivr (tag-pinned).
const String kMapsContentBase = 'https://underpunks55.github.io/underdeck-content';

/// The mutable pointer document (small, polled ≤1/24h with ETag).
const String kMapsPointerUrl = '$kMapsContentBase/pointer/latest-v1.json';

/// Raw-GitHub fallback for the pointer only. `raw.githubusercontent.com` was
/// rate-limit-hardened in May 2025 (429s behind CGNAT), so it is a fallback,
/// never the primary path (AUDIT-V2 §4.1).
const String kMapsPointerFallbackUrl =
    'https://raw.githubusercontent.com/underpunks55/underdeck-content/main/pointer/latest-v1.json';

/// Base error for the fetch layer. Callers switch on the subtypes to decide
/// whether to keep the installed pack (any of these => keep local content).
sealed class MapFetchException implements Exception {
  final String message;
  const MapFetchException(this.message);
  @override
  String toString() => '$runtimeType: $message';
}

/// A downloaded body exceeded the declared/enforced byte cap (either the
/// `Content-Length` header or the streamed length crossing the cap).
class MapTooLargeException extends MapFetchException {
  const MapTooLargeException(super.message);
}

/// The bytes did not hash to the sha256 the manifest/pointer pinned. Because
/// the content is immutable and identical across CDNs, this is a hard reject
/// (not something a CDN fallback can fix).
class MapFetchIntegrityException extends MapFetchException {
  const MapFetchIntegrityException(super.message);
}

/// Transport failed on both the primary and fallback URLs.
class MapTransportException extends MapFetchException {
  const MapTransportException(super.message);
}

/// Outcome of a conditional pointer fetch.
class PointerFetchResult {
  /// The server answered 304 Not Modified — the installed pointer is current.
  final bool notModified;

  /// Raw pointer bytes (null when [notModified]).
  final Uint8List? bytes;

  /// The response ETag, to persist and send as `If-None-Match` next time.
  final String? etag;

  /// Decoded byte length of [bytes] (0 when [notModified]).
  final int byteLength;

  const PointerFetchResult.notModified()
      : notModified = true,
        bytes = null,
        etag = null,
        byteLength = 0;

  PointerFetchResult.fetched(Uint8List this.bytes, this.etag)
      : notModified = false,
        byteLength = bytes.length;
}

/// Network access for the maps pipeline. Fetches are size-capped and streamed
/// (so an oversized body is aborted mid-stream, not buffered whole), and every
/// content blob is sha256-verified before it is returned.
///
/// Reuses the shared [appDioProvider] (10s/30s timeouts + bounded GET/HEAD
/// retry). That retry does NOT retry 404/429, which is exactly why the
/// jsDelivr→raw fallback is implemented here.
class MapFetcher {
  final Dio _dio;
  const MapFetcher(this._dio);

  /// Conditionally fetches the pointer. Sends `If-None-Match: [etag]` when
  /// provided; a 304 short-circuits to [PointerFetchResult.notModified]. Falls
  /// back to raw GitHub on any primary failure. Enforces the pointer size cap.
  Future<PointerFetchResult> fetchPointer({String? etag}) async {
    final headers = <String, String>{
      if (etag != null && etag.isNotEmpty) 'If-None-Match': etag,
    };
    _Downloaded d;
    try {
      d = await _download(
        kMapsPointerUrl,
        headers: headers,
        maxBytes: MapLimits.pointerMaxBytes,
      );
    } on MapTooLargeException {
      rethrow; // Same body on the fallback — do not retry an oversized pointer.
    } on MapFetchException {
      d = await _download(
        kMapsPointerFallbackUrl,
        headers: headers,
        maxBytes: MapLimits.pointerMaxBytes,
      );
    }
    if (d.notModified) return const PointerFetchResult.notModified();
    return PointerFetchResult.fetched(d.bytes!, d.etag);
  }

  /// Fetches [primaryUrl] (jsDelivr), falling back to [fallbackUrl] (raw
  /// GitHub) on any transport failure, enforces [maxBytes], and verifies the
  /// bytes hash to [expectedSha256]. Throws [MapFetchIntegrityException] on a
  /// hash mismatch, [MapTooLargeException] past the cap, or
  /// [MapTransportException] when both URLs fail.
  Future<Uint8List> fetchVerified({
    required String primaryUrl,
    String? fallbackUrl,
    required String expectedSha256,
    required int maxBytes,
  }) async {
    _Downloaded d;
    try {
      d = await _download(primaryUrl, maxBytes: maxBytes);
    } on MapTooLargeException {
      rethrow; // The immutable body is the same on the fallback CDN.
    } on MapFetchException {
      if (fallbackUrl == null || fallbackUrl.isEmpty) {
        throw const MapTransportException('primary failed, no fallback');
      }
      d = await _download(fallbackUrl, maxBytes: maxBytes);
    }
    // fetchVerified never sends If-None-Match, so a 304 here is a misbehaving
    // CDN, not a legitimate not-modified — fail typed rather than crash on the
    // null body assertion.
    final bytes = d.bytes;
    if (bytes == null) {
      throw const MapTransportException('unexpected 304 (no conditional request)');
    }
    if (!verifyBytes(bytes, expectedSha256)) {
      throw MapFetchIntegrityException(
        'sha256 mismatch (expected $expectedSha256)',
      );
    }
    return bytes;
  }

  /// Streams [url] into memory, aborting as soon as either the declared
  /// `Content-Length` or the accumulated length crosses [maxBytes]. A 304 (only
  /// meaningful with an `If-None-Match` header) resolves to a not-modified
  /// marker.
  Future<_Downloaded> _download(
    String url, {
    Map<String, String> headers = const {},
    required int maxBytes,
  }) async {
    Response<ResponseBody> response;
    try {
      response = await _dio.get<ResponseBody>(
        url,
        options: Options(
          responseType: ResponseType.stream,
          headers: headers,
          validateStatus: (s) => s == 200 || s == 304,
        ),
      );
    } on DioException catch (e) {
      throw MapTransportException('${e.type} on $url');
    }

    if (response.statusCode == 304) {
      return const _Downloaded.notModified();
    }

    final declared = int.tryParse(
      response.headers.value(Headers.contentLengthHeader) ?? '',
    );
    if (declared != null && declared > maxBytes) {
      throw MapTooLargeException(
        'Content-Length $declared > $maxBytes cap on $url',
      );
    }

    final etag = response.headers.value('etag');
    final builder = BytesBuilder(copy: false);
    final body = response.data;
    if (body == null) {
      throw MapTransportException('empty body on $url');
    }
    try {
      await for (final chunk in body.stream) {
        builder.add(chunk);
        if (builder.length > maxBytes) {
          // Abort the stream: stop pulling and drop what we have.
          throw MapTooLargeException(
            'stream exceeded $maxBytes cap on $url',
          );
        }
      }
    } on DioException catch (e) {
      throw MapTransportException('${e.type} while streaming $url');
    }
    return _Downloaded.fetched(builder.toBytes(), etag);
  }
}

/// Internal download outcome (bytes or a 304 marker).
class _Downloaded {
  final bool notModified;
  final Uint8List? bytes;
  final String? etag;

  const _Downloaded.notModified()
      : notModified = true,
        bytes = null,
        etag = null;

  const _Downloaded.fetched(this.bytes, this.etag) : notModified = false;
}

final mapFetcherProvider = Provider<MapFetcher>((ref) {
  return MapFetcher(ref.watch(appDioProvider));
});
