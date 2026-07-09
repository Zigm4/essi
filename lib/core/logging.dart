import 'package:flutter/foundation.dart';

/// Minimal centralized error logger.
///
/// Routes caught/uncaught errors to [debugPrint] so failures surface in the
/// console instead of being silently swallowed. Intentionally lightweight —
/// swap the body for a real crash-reporting sink later without touching call
/// sites.
void logError(Object error, [StackTrace? stack]) {
  debugPrint('[Underdeck] ERROR: $error');
  if (stack != null) {
    debugPrint(stack.toString());
  }
}
