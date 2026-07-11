/**
 * Byte-capped streaming fetcher with ETag/If-None-Match, bounded retry and
 * jsDelivr→raw fallback (maps spec §4.2). `fetch` + `ReadableStream` reader,
 * aborting past the cap via `AbortController`. GitHub Pages/raw/jsDelivr all
 * send `Access-Control-Allow-Origin: *`, so requests go DIRECTLY (no proxy).
 */

import { kMapsPointerFallbackUrl, kMapsPointerUrl } from './endpoints';
import { verifyBytes } from './sha256';

const CONNECT_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [500, 1500] as const;

export class MapFetchException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapFetchException';
  }
}
export class MapTooLargeException extends MapFetchException {
  constructor(message: string) {
    super(message);
    this.name = 'MapTooLargeException';
  }
}
export class MapFetchIntegrityException extends MapFetchException {
  constructor(message: string) {
    super(message);
    this.name = 'MapFetchIntegrityException';
  }
}
export class MapTransportException extends MapFetchException {
  /** HTTP status when the failure was an unexpected status; else undefined. */
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MapTransportException';
    this.status = status;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

interface CappedResult {
  readonly notModified: boolean;
  // Always a fresh, plain-ArrayBuffer-backed view (from `concat` / arrayBuffer());
  // typed explicitly so TS 5.7's tightened BufferSource accepts it downstream.
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly etag: string;
  readonly byteLength: number;
}

/** One capped GET attempt (no retry). Throws Map*Exception on any failure. */
async function attemptCapped(
  url: string,
  headers: Record<string, string>,
  maxBytes: number,
): Promise<CappedResult> {
  const controller = new AbortController();
  let timedOut = false;
  const connectTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CONNECT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(connectTimer);
    if (timedOut) throw new MapTransportException(`timeout on ${url}`);
    if (e instanceof TypeError) throw new MapTransportException(`network on ${url}`);
    throw new MapTransportException(`${String(e)} on ${url}`);
  }
  clearTimeout(connectTimer);

  if (response.status === 304) {
    return { notModified: true, bytes: new Uint8Array(0), etag: headers['If-None-Match'] ?? '', byteLength: 0 };
  }
  if (response.status !== 200) {
    throw new MapTransportException(`HTTP ${response.status} on ${url}`, response.status);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const n = Number.parseInt(contentLength, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new MapTooLargeException(`Content-Length ${n} > ${maxBytes} cap on ${url}`);
    }
  }
  const etag = response.headers.get('etag') ?? '';

  if (response.body === null) {
    // No stream available — fall back to a buffered read, still cap-checked.
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new MapTooLargeException(`stream exceeded ${maxBytes} cap on ${url}`);
    }
    return { notModified: false, bytes: buf, etag, byteLength: buf.byteLength };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const readTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, READ_TIMEOUT_MS);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== undefined) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new MapTooLargeException(`stream exceeded ${maxBytes} cap on ${url}`);
        }
        chunks.push(value);
      }
    }
  } catch (e) {
    if (e instanceof MapFetchException) throw e;
    if (timedOut) throw new MapTransportException(`timeout on ${url}`);
    throw new MapTransportException(`${String(e)} on ${url}`);
  } finally {
    clearTimeout(readTimer);
  }
  return { notModified: false, bytes: concat(chunks, total), etag, byteLength: total };
}

function isTransient(e: unknown): boolean {
  if (e instanceof MapTooLargeException) return false;
  if (e instanceof MapTransportException) {
    // Network/timeout (no status) retry; 5xx retry; 404/429 do not.
    return e.status === undefined || e.status >= 500;
  }
  return false;
}

/** Capped GET with bounded retry on transient failures. */
async function fetchCapped(
  url: string,
  headers: Record<string, string>,
  maxBytes: number,
): Promise<CappedResult> {
  let attempt = 0;
  for (;;) {
    try {
      return await attemptCapped(url, headers, maxBytes);
    } catch (e) {
      if (attempt >= MAX_RETRIES || !isTransient(e)) throw e;
      await delay(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
      attempt += 1;
    }
  }
}

export type PointerFetch =
  | { readonly notModified: true }
  | { readonly notModified: false; readonly bytes: Uint8Array; readonly etag: string; readonly byteLength: number };

/**
 * Conditional pointer fetch: sends `If-None-Match` when `etag` is non-empty;
 * on any primary failure EXCEPT MapTooLargeException, retries the raw fallback
 * with the same headers.
 */
export async function fetchPointer(options: { etag?: string } = {}): Promise<PointerFetch> {
  const headers: Record<string, string> = {};
  if (options.etag !== undefined && options.etag.length > 0) {
    headers['If-None-Match'] = options.etag;
  }
  const cap = 64 * 1024;
  let primaryError: unknown;
  try {
    const r = await fetchCapped(kMapsPointerUrl, headers, cap);
    return r.notModified
      ? { notModified: true }
      : { notModified: false, bytes: r.bytes, etag: r.etag, byteLength: r.byteLength };
  } catch (e) {
    if (e instanceof MapTooLargeException) throw e; // oversized on both hosts — do not retry
    primaryError = e;
  }
  try {
    const r = await fetchCapped(kMapsPointerFallbackUrl, headers, cap);
    return r.notModified
      ? { notModified: true }
      : { notModified: false, bytes: r.bytes, etag: r.etag, byteLength: r.byteLength };
  } catch {
    throw primaryError instanceof Error ? primaryError : new MapTransportException('pointer fetch failed');
  }
}

/**
 * Fetch primary → fallback on transport failure, then verify sha256. A hash
 * mismatch is a HARD reject (content is immutable & identical across CDNs).
 */
export async function fetchVerified(args: {
  primaryUrl: string;
  fallbackUrl: string | null;
  expectedSha256: string;
  maxBytes: number;
}): Promise<{ bytes: Uint8Array; byteLength: number }> {
  const headers: Record<string, string> = {};
  let bytes: Uint8Array<ArrayBuffer>;
  let byteLength: number;
  try {
    const r = await fetchCapped(args.primaryUrl, headers, args.maxBytes);
    if (r.notModified) {
      throw new MapTransportException('unexpected 304 (no conditional request)');
    }
    bytes = r.bytes;
    byteLength = r.byteLength;
  } catch (e) {
    if (e instanceof MapTooLargeException) throw e; // same size on both hosts
    if (args.fallbackUrl === null || args.fallbackUrl.length === 0) {
      throw new MapTransportException('primary failed, no fallback');
    }
    const r = await fetchCapped(args.fallbackUrl, headers, args.maxBytes);
    if (r.notModified) {
      throw new MapTransportException('unexpected 304 (no conditional request)');
    }
    bytes = r.bytes;
    byteLength = r.byteLength;
  }
  const ok = await verifyBytes(bytes, args.expectedSha256);
  if (!ok) {
    throw new MapFetchIntegrityException(`sha256 mismatch (expected ${args.expectedSha256})`);
  }
  return { bytes, byteLength };
}
