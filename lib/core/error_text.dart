import 'package:dio/dio.dart';

/// Turns a caught error into a short, human-readable message safe to show a
/// user — never the raw `toString()` of an exception (which leaks technical
/// detail like `SqliteException(...)` or `DioException [connectionError]`).
///
/// It reuses the typed messages the app already curates: transport failures via
/// [DioException] get a signal-focused message, and [FormatException] carries a
/// human `message` (e.g. import/parse copy). Everything else — DB reads, asset
/// loads, unexpected failures — collapses to a friendly, screen-appropriate
/// [fallback] so no raw exception text ever reaches the UI.
///
/// The sealed network-error hierarchies (scan / tracker / celestial) already
/// surface their own curated `message` at their call sites, so they are not
/// re-handled here.
///
/// Deliberately self-contained (only `dart:*` + Dio) so the core layer stays
/// decoupled from any feature.
String friendlyError(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  // Network transport problems get a signal-focused message regardless of
  // whichever client surfaced them.
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'No network connection. Check your signal and try again.';
      case DioExceptionType.cancel:
        return 'Request cancelled.';
      case DioExceptionType.badResponse:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return "Couldn't reach the server. Please try again.";
    }
  }

  // FormatException carries a curated, user-facing `message` in this app.
  if (error is FormatException) {
    final msg = error.message.trim();
    if (msg.isNotEmpty) return msg;
  }

  return fallback;
}
