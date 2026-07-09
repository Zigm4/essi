import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// F17 — one shared, configured Dio for every JPL client.
///
/// Provides sane connect/receive timeouts so the
/// [DioExceptionType.connectionTimeout] catch branches in the clients become
/// live (a bare `Dio()` has no connect timeout, so they were dead code).
/// Per-request `receiveTimeout` overrides set via `Options` still win.
final appDioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
    ),
  );
  // F48 — bounded retry for idempotent GETs.
  dio.interceptors.add(RetryInterceptor(dio));
  return dio;
});

/// F48 — retries idempotent GET requests a bounded number of times on
/// transient failures (connection errors/timeouts and 5xx responses).
///
/// Guarantees:
/// - never retries a cancelled request (respects the [CancelToken]);
/// - never retries a non-idempotent method (only GET/HEAD);
/// - retries at most [maxRetries] times with the configured [delays] backoff.
class RetryInterceptor extends Interceptor {
  RetryInterceptor(
    this._dio, {
    this.maxRetries = 2,
    this.delays = const [
      Duration(milliseconds: 500),
      Duration(milliseconds: 1500),
    ],
  });

  final Dio _dio;
  final int maxRetries;
  final List<Duration> delays;

  static const _attemptKey = 'retry_attempt';

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;

    // Never retry a cancelled request.
    if (CancelToken.isCancel(err)) {
      return handler.next(err);
    }

    // Only retry idempotent methods.
    final method = options.method.toUpperCase();
    if (method != 'GET' && method != 'HEAD') {
      return handler.next(err);
    }

    if (!_isTransient(err)) {
      return handler.next(err);
    }

    final attempt = (options.extra[_attemptKey] as int?) ?? 0;
    if (attempt >= maxRetries) {
      return handler.next(err);
    }

    final delay = attempt < delays.length ? delays[attempt] : delays.last;
    await Future<void>.delayed(delay);

    // The request may have been cancelled while we were backing off.
    if (options.cancelToken?.isCancelled ?? false) {
      return handler.next(err);
    }

    final retryOptions = options.copyWith(
      extra: {...options.extra, _attemptKey: attempt + 1},
    );

    try {
      final response = await _dio.fetch<dynamic>(retryOptions);
      return handler.resolve(response);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  bool _isTransient(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
        return true;
      default:
        break;
    }
    final status = err.response?.statusCode;
    return status != null && status >= 500 && status <= 599;
  }
}
