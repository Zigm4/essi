/** Typed error taxonomy mirrored from the mobile app's Dio/FormatException split. */

export type NetworkErrorKind =
  | 'offline' // transport failure - no connection
  | 'timeout' // connect/read timeout
  | 'cancelled' // caller aborted
  | 'http' // non-2xx response
  | 'unknown';

export class NetworkError extends Error {
  readonly kind: NetworkErrorKind;
  readonly status: number | undefined;

  constructor(kind: NetworkErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'NetworkError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Parse/format error carrying a curated, user-facing message
 * (the web mirror of Dart's FormatException).
 */
export class FormatException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatException';
  }
}
