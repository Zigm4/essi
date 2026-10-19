import { NetworkError } from '../../../core/errors';
import {
  CelestialCancelledError,
  CelestialDateOutOfRangeError,
  CelestialHttpError,
  CelestialOfflineError,
  CelestialTimeoutError,
  CelestialUnparseableError,
} from './errors';
import { jplRequest } from './jplClient';
import { filterHistorical, parseSbdbObjects, type DiscoveredObject, type ObjectKind } from './sbdb';

/**
 * NASA SBDB bulk-query client for Discoveries (tools-live spec §5.4). Routed
 * through the proxy `/sbdb_query` route. Handles calendar-date validation, the
 * pre-1900 whole-catalog strategy, truncation detection, and timeouts.
 */

const COMET_TIMEOUT_MS = 30_000;
const ASTEROID_TIMEOUT_MS = 90_000;
const NORMAL_LIMIT = 1000;
const HISTORICAL_LIMIT = 50000;
const MS_PER_DAY = 86_400_000;

export interface SearchInput {
  kind: ObjectKind;
  startDate: Date;
  endDate: Date;
}

export interface SearchResult {
  objects: DiscoveredObject[];
  truncated: boolean;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** `YYYY-MM-DD` straight from the local calendar fields (no TZ shift). */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Calendar days in the window, both ends included (the SBDB `RG` filter is
 * inclusive): one day → 1. Counted on calendar dates, so a DST change can't
 * remove an hour and a day.
 */
export function windowDays(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / MS_PER_DAY) + 1;
}

/**
 * A typed or picked `YYYY-MM-DD` within [min, max], else null. setFullYear,
 * not `new Date(y, …)`: the latter turns years 0-99 into 1900-1999, so typing
 * a year digit by digit jumped to 1902, 1920…
 */
export function parseYmdInRange(value: string, min: string, max: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m === null || value < min || value > max) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

export function isWideWindow(kind: ObjectKind, days: number): boolean {
  return kind === 'asteroid' ? days > 11 : days > 31;
}

export interface ExpectedSeconds {
  lo: number;
  hi: number;
}

export function expectedSeconds(kind: ObjectKind, days: number): ExpectedSeconds {
  if (kind === 'comet') {
    return days < 12 ? { lo: 1, hi: 4 } : { lo: 4, hi: 20 };
  }
  if (days < 12) return { lo: 5, hi: 30 };
  if (days < 32) return { lo: 20, hi: 60 };
  return { lo: 30, hi: 90 };
}

function mapCelestialNetworkError(e: unknown): never {
  if (e instanceof NetworkError) {
    if (e.kind === 'timeout') throw new CelestialTimeoutError();
    if (e.kind === 'offline') throw new CelestialOfflineError();
    if (e.kind === 'cancelled') throw new CelestialCancelledError();
    if (e.kind === 'http') throw new CelestialHttpError(e.status ?? 0);
  }
  throw new CelestialUnparseableError();
}

export async function searchDiscoveries(
  base: string,
  input: SearchInput,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const startYmd = ymdLocal(input.startDate);
  const endYmd = ymdLocal(input.endDate);
  const todayYmd = ymdLocal(new Date());
  if (startYmd > endYmd || endYmd > todayYmd) {
    throw new CelestialDateOutOfRangeError();
  }

  const isHistorical = input.startDate.getFullYear() < 1900;
  const limit = isHistorical ? HISTORICAL_LIMIT : NORMAL_LIMIT;

  const fields =
    input.kind === 'comet'
      ? 'full_name,name,kind,pdes,first_obs,last_obs,pha'
      : 'full_name,name,kind,pdes,first_obs,last_obs,pha,diameter,albedo';

  const params: Record<string, string> = {
    'sb-kind': input.kind === 'comet' ? 'c' : 'a',
    fields,
    limit: String(limit),
  };
  if (!isHistorical) {
    params['sb-cdata'] = JSON.stringify({ AND: [`first_obs|RG|${startYmd}|${endYmd}`] });
  }

  let status: number;
  let body: string;
  try {
    // One deadline for the whole query: SBDB sends its headers only once the
    // result is computed (7-9 s measured for asteroids), so a 10 s "connect"
    // timeout would cut it. A timeout isn't retried - re-running a query that
    // just took 90 s only makes the wait longer.
    const timeoutMs = input.kind === 'asteroid' ? ASTEROID_TIMEOUT_MS : COMET_TIMEOUT_MS;
    const res = await jplRequest(base, 'sbdb_query', params, {
      connectTimeoutMs: timeoutMs,
      readTimeoutMs: timeoutMs,
      retryOnTimeout: false,
      signal,
    });
    status = res.status;
    body = res.body;
  } catch (e) {
    mapCelestialNetworkError(e);
  }
  if (status < 200 || status >= 300) throw new CelestialHttpError(status);

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new CelestialUnparseableError();
  }

  const rawCount = countData(json);
  let objects = parseSbdbObjects(json, input.kind);
  if (isHistorical) {
    objects = filterHistorical(objects, startYmd, endYmd);
  }
  return { objects, truncated: rawCount >= limit };
}

function countData(json: unknown): number {
  if (typeof json === 'object' && json !== null) {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data.length;
  }
  return 0;
}
