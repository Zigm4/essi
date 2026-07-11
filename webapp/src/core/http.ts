import { NetworkError } from './errors';

/**
 * Shared HTTP client mirroring lib/core/network/app_dio.dart:
 * - connect timeout 10s (headers must arrive), read timeout 30s (body)
 * - bounded retry for GET/HEAD only: max 2 retries, 500ms then 1500ms backoff,
 *   on transient failures (network error / timeout / HTTP 5xx),
 *   never after a caller cancellation.
 */

const CONNECT_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [500, 1500] as const;

export interface AppFetchOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  signal?: AbortSignal;
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
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

async function attemptFetch(url: string, options: AppFetchOptions): Promise<string> {
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
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        signal: controller.signal,
      });
    } catch (e) {
      if (options.signal?.aborted) throw new NetworkError('cancelled', 'Request cancelled');
      if (timedOut) throw new NetworkError('timeout', 'Connect timeout');
      if (e instanceof TypeError) throw new NetworkError('offline', 'Connection error');
      throw new NetworkError('unknown', String(e));
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      throw new NetworkError('http', `HTTP ${response.status}`, response.status);
    }

    const readTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.readTimeoutMs ?? READ_TIMEOUT_MS);
    try {
      return await response.text();
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

function isTransient(e: unknown): boolean {
  if (!(e instanceof NetworkError)) return false;
  if (e.kind === 'offline' || e.kind === 'timeout') return true;
  return e.kind === 'http' && e.status !== undefined && e.status >= 500;
}

/** Fetch the response body as text, with timeouts and bounded retry. */
export async function appFetchText(url: string, options: AppFetchOptions = {}): Promise<string> {
  const method = options.method ?? 'GET';
  const retryable = method === 'GET' || method === 'HEAD';
  let attempt = 0;
  for (;;) {
    try {
      return await attemptFetch(url, options);
    } catch (e) {
      const cancelled = e instanceof NetworkError && e.kind === 'cancelled';
      if (cancelled || !retryable || attempt >= MAX_RETRIES || !isTransient(e)) throw e;
      await delay(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)], options.signal);
      attempt += 1;
    }
  }
}

/** Fetch and JSON-parse. A body that fails to parse surfaces as 'unknown'. */
export async function appFetchJson(url: string, options: AppFetchOptions = {}): Promise<unknown> {
  const text = await appFetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new NetworkError('unknown', 'Unparseable response body');
  }
}
