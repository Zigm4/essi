import { NetworkError } from '../../../core/errors';
import {
  CelestialCancelledError,
  CelestialDateOutOfRangeError,
  CelestialHttpError,
  CelestialOfflineError,
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

export function windowDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function isWideWindow(kind: ObjectKind, days: number): boolean {
  return kind === 'asteroid' ? days > 10 : days > 30;
}

export interface ExpectedSeconds {
  lo: number;
  hi: number;
}

export function expectedSeconds(kind: ObjectKind, days: number): ExpectedSeconds {
  if (kind === 'comet') {
    return days < 11 ? { lo: 1, hi: 4 } : { lo: 4, hi: 20 };
  }
  if (days < 11) return { lo: 5, hi: 30 };
  if (days < 31) return { lo: 20, hi: 60 };
  return { lo: 30, hi: 90 };
}

function mapCelestialNetworkError(e: unknown): never {
  if (e instanceof NetworkError) {
    if (e.kind === 'offline' || e.kind === 'timeout') throw new CelestialOfflineError();
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
    const res = await jplRequest(base, 'sbdb_query', params, {
      readTimeoutMs: input.kind === 'asteroid' ? ASTEROID_TIMEOUT_MS : COMET_TIMEOUT_MS,
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
