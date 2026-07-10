import 'package:flutter/foundation.dart';

/// Minimal centralized error logger with a pluggable crash-reporting seam.
///
/// [logError] is the single sink every caught/uncaught error flows through
/// (call sites in feature code, plus `runZonedGuarded` /
/// `FlutterError.onError` / `PlatformDispatcher.onError` in `main.dart`).
///
/// By default it only routes to [debugPrint] so failures surface in the
/// console instead of being silently swallowed. To ship crashes to a real
/// backend (Sentry, Crashlytics, …) attach an [ErrorReporter] via
/// [setErrorReporter] in exactly ONE place — `main.dart`, after the SDK is
/// initialized — without touching any call site. See the wiring note below.

/// A crash-reporting hook: receives the same error/stack that [logError] gets.
///
/// Keep implementations non-throwing — this runs inside error handlers, so a
/// throw here would mask the original failure.
typedef ErrorReporter = void Function(Object error, StackTrace? stack);

/// No-op default so [logError] never depends on a reporter being attached.
void _noopReporter(Object error, StackTrace? stack) {}

ErrorReporter _reporter = _noopReporter;

/// Attaches (or replaces) the crash-reporting sink. Pass `null` to detach.
///
/// Wire a real reporter here, e.g. in `main.dart`:
/// ```dart
/// await SentryFlutter.init((o) => o.dsn = '<DSN>');
/// setErrorReporter((error, stack) => Sentry.captureException(error, stackTrace: stack));
/// ```
/// Because every error already flows through [logError], this is the only edit
/// needed to enable remote crash reporting — no call site changes.
void setErrorReporter(ErrorReporter? reporter) {
  _reporter = reporter ?? _noopReporter;
}

/// Routes a caught/uncaught error to the console (debug builds) and to the
/// attached [ErrorReporter] (all builds).
void logError(Object error, [StackTrace? stack]) {
  if (kDebugMode) {
    debugPrint('[Underdeck] ERROR: $error');
    if (stack != null) {
      debugPrint(stack.toString());
    }
  }
  // Never let the reporter throw out of an error handler.
  try {
    _reporter(error, stack);
  } catch (_) {}
}
