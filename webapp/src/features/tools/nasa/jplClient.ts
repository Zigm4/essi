import { NetworkError } from '../../../core/errors';
import { JPL_PROXY_URL } from '../../../config';

/**
 * Proxy-aware JPL transport (tools-live spec §2 + CORS constraint).
 *
 * JPL's `ssd.jpl.nasa.gov` / `ssd-api.jpl.nasa.gov` send no CORS headers, so
 * the browser can never call them directly. Every request is routed through a
 * user-deployed Cloudflare Worker whose base URL is `settings.jplProxyUrl`
 * (seeded from VITE_JPL_PROXY_URL). The proxy exposes three pass-through routes:
 *
 *   `${base}/horizons?<query>`    → ssd.jpl.nasa.gov/api/horizons.api
 *   `${base}/sbdb?<query>`        → ssd-api.jpl.nasa.gov/sbdb.api
 *   `${base}/sbdb_query?<query>`  → ssd-api.jpl.nasa.gov/sbdb_query.api
 *
 * Unlike core/http's `appFetchText`, this primitive returns `{ status, body }`
 * for ANY completed HTTP response instead of throwing on non-2xx - SBDB
 * legitimately returns HTTP 300 (multi-match, body carries `list`) and 404
 * (genuine not-found), and callers must read those bodies / status codes. It
 * keeps the shared 10s-connect / configurable-read timeouts and the bounded
 * transient retry (2×, 500ms then 1500ms; retries offline/timeout and HTTP 5xx).
 */

export type JplRoute = 'horizons' | 'sbdb' | 'sbdb_query';

export interface JplResponse {
  status: number;
  body: string;
}

export interface JplRequestOptions {
  signal?: AbortSignal;
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
}

const CONNECT_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [500, 1500] as const;

/**
 * Normalise a user-entered proxy URL so common mistakes still work:
 * trims whitespace, adds a scheme when missing, upgrades http→https (a
 * workers.dev proxy is https-only, and an https page blocks http as mixed
 * content - the #1 "no internet" trap), and strips trailing slashes.
 * localhost keeps http for local development.
 */
export function normalizeProxyUrl(raw: string): string {
  let t = raw.trim();
  if (t.length === 0) return '';
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  if (/^http:\/\//i.test(t) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(t)) {
    t = `https://${t.slice('http://'.length)}`;
  }
  return t.replace(/\/+$/, '');
}

/** Normalised proxy base from the fixed app config, or null if somehow blank. */
export function resolveProxyBase(): string | null {
  const normalized = normalizeProxyUrl(JPL_PROXY_URL);
  return normalized.length === 0 ? null : normalized;
}

/** Build the proxied URL, forwarding the exact JPL query params (single-quoted
 *  values are encoded verbatim: `'` → %27, `;` → %3B, etc.). */
export function buildJplUrl(base: string, route: JplRoute, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base.replace(/\/+$/, '')}/${route}?${qs}`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new NetworkError('cancelled', 'Request cancelled'));
      },
      { once: true },
    );
  });
}

async function attempt(url: string, options: JplRequestOptions): Promise<JplResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  const connectTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', signal: controller.signal });
    } catch (e) {
      if (options.signal?.aborted) throw new NetworkError('cancelled', 'Request cancelled');
      if (timedOut) throw new NetworkError('timeout', 'Connect timeout');
      if (e instanceof TypeError) throw new NetworkError('offline', 'Connection error');
      throw new NetworkError('unknown', String(e));
    } finally {
      clearTimeout(connectTimer);
    }

    const readTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.readTimeoutMs ?? READ_TIMEOUT_MS);
    try {
      const body = await response.text();
      return { status: response.status, body };
    } catch (e) {
      if (options.signal?.aborted) throw new NetworkError('cancelled', 'Request cancelled');
      if (timedOut) throw new NetworkError('timeout', 'Receive timeout');
      throw new NetworkError('unknown', String(e));
    } finally {
      clearTimeout(readTimer);
    }
  } finally {
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * GET a proxied JPL route. Returns `{ status, body }` for any HTTP response
 * (including 3xx/4xx/5xx); throws NetworkError only for transport failures
 * (offline/timeout/cancelled/unknown). Retries transient failures and 5xx.
 */
export async function jplRequest(
  base: string,
  route: JplRoute,
  params: Record<string, string>,
  options: JplRequestOptions = {},
): Promise<JplResponse> {
  const url = buildJplUrl(base, route, params);
  let attemptCount = 0;
  for (;;) {
    try {
      const res = await attempt(url, options);
      if (res.status >= 500 && attemptCount < MAX_RETRIES) {
        await delay(RETRY_DELAYS_MS[Math.min(attemptCount, RETRY_DELAYS_MS.length - 1)]!, options.signal);
        attemptCount += 1;
        continue;
      }
      return res;
    } catch (e) {
      const cancelled = e instanceof NetworkError && e.kind === 'cancelled';
      const transient = e instanceof NetworkError && (e.kind === 'offline' || e.kind === 'timeout');
      if (cancelled || !transient || attemptCount >= MAX_RETRIES) throw e;
      await delay(RETRY_DELAYS_MS[Math.min(attemptCount, RETRY_DELAYS_MS.length - 1)]!, options.signal);
      attemptCount += 1;
    }
  }
}
