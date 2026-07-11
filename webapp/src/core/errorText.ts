import { FormatException, NetworkError } from './errors';

/**
 * Converts any caught error into short, human-safe copy.
 * Raw exception text must never reach the UI (app-shell spec §13.3).
 */
export function friendlyError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof NetworkError) {
    switch (error.kind) {
      case 'offline':
      case 'timeout':
        return 'No network connection. Check your signal and try again.';
      case 'cancelled':
        return 'Request cancelled.';
      case 'http':
      case 'unknown':
        return "Couldn't reach the server. Please try again.";
    }
  }
  if (error instanceof FormatException && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return fallback;
}
