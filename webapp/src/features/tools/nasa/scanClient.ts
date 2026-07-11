import { NetworkError } from '../../../core/errors';
import {
  ScanApiMessageError,
  ScanCancelledError,
  ScanHttpError,
  ScanNoDataError,
  ScanOfflineError,
  ScanUnparseableError,
} from './errors';
import { HorizonsFormatError, parseHorizonsEphemeris, type RawPosition } from './horizonsParser';
import { jplRequest } from './jplClient';
import type { PlanetPosition } from './models';
import type { PlanetSpec } from './planets';
import { computeScanMetrics, computeSector } from './sectorMath';

/**
 * System Scan Horizons client (tools-live spec §4.5, §4.6). Light = one vector
 * request per planet; Full = one broad sweep + an optional refinement to locate
 * the next sector change. All requests go through the proxy `/horizons` route.
 */

const SCAN_READ_TIMEOUT_MS = 30_000;
export const INTER_REQUEST_DELAY_MS = 200;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** `YYYY-MM-DD HH:mm` in UTC (Horizons START/STOP). */
function fmtMinute(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
    d.getUTCHours(),
  )}:${pad2(d.getUTCMinutes())}`;
}

function mapScanNetworkError(e: unknown): never {
  if (e instanceof NetworkError) {
    if (e.kind === 'offline' || e.kind === 'timeout') throw new ScanOfflineError();
    if (e.kind === 'cancelled') throw new ScanCancelledError();
    if (e.kind === 'http') throw new ScanHttpError(e.status ?? 0);
    throw new ScanUnparseableError();
  }
  if (e instanceof HorizonsFormatError) throw new ScanApiMessageError(e.preview);
  throw new ScanUnparseableError();
}

interface HorizonsWindow {
  start: Date;
  stop: Date;
  step: string;
}

/** One Horizons VECTORS request → parsed positions, mapping errors to ScanError. */
async function fetchPositions(
  base: string,
  code: string,
  window: HorizonsWindow,
  signal: AbortSignal | undefined,
): Promise<RawPosition[]> {
  const params: Record<string, string> = {
    format: 'text',
    COMMAND: `'${code}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    OUT_UNITS: "'KM-S'",
    START_TIME: `'${fmtMinute(window.start)}'`,
    STOP_TIME: `'${fmtMinute(window.stop)}'`,
    STEP_SIZE: `'${window.step}'`,
    QUANTITIES: "'1'",
  };
  let status: number;
  let body: string;
  try {
    const res = await jplRequest(base, 'horizons', params, {
      readTimeoutMs: SCAN_READ_TIMEOUT_MS,
      signal,
    });
    status = res.status;
    body = res.body;
  } catch (e) {
    mapScanNetworkError(e);
  }
  if (status < 200 || status >= 300) throw new ScanHttpError(status);
  try {
    return parseHorizonsEphemeris(body);
  } catch (e) {
    mapScanNetworkError(e);
  }
}

function toPosition(planet: PlanetSpec, sample: RawPosition): PlanetPosition {
  const { sector, distanceSL } = computeScanMetrics(sample.x, sample.y);
  return {
    name: planet.name,
    emoji: planet.emoji,
    sector,
    distanceSL,
    timestamp: sample.date,
  };
}

/** First sample whose sector differs from the running previous one. */
function findFirstTransition(positions: RawPosition[]): { date: Date; toSector: number } | null {
  if (positions.length === 0) return null;
  let prev = computeSector(positions[0]!.x, positions[0]!.y);
  for (let i = 1; i < positions.length; i++) {
    const cur = computeSector(positions[i]!.x, positions[i]!.y);
    if (cur !== prev) return { date: positions[i]!.date, toSector: cur };
    prev = cur;
  }
  return null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ScanCancelledError());
      },
      { once: true },
    );
  });
}

/** Light fetch: current sector + distance for one planet. */
export async function fetchLight(
  base: string,
  planet: PlanetSpec,
  now: Date,
  signal?: AbortSignal,
): Promise<PlanetPosition> {
  const stop = new Date(now.getTime() + 60 * 60 * 1000);
  const positions = await fetchPositions(base, planet.code, { start: now, stop, step: '1h' }, signal);
  if (positions.length === 0) throw new ScanNoDataError();
  return toPosition(planet, positions[0]!);
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/** Full fetch: light data + the next sector change (broad sweep + refinement). */
export async function fetchFull(
  base: string,
  planet: PlanetSpec,
  now: Date,
  signal?: AbortSignal,
): Promise<PlanetPosition> {
  const w = planet.window;
  const broadStop = new Date(now.getTime() + w.broadDays * MS_PER_DAY);
  const broad = await fetchPositions(
    base,
    planet.code,
    { start: now, stop: broadStop, step: w.broadStep },
    signal,
  );
  if (broad.length === 0) throw new ScanNoDataError();

  const position = toPosition(planet, broad[0]!);
  const rough = findFirstTransition(broad);
  if (rough === null) return position;

  // A transition exists — refine around it. Errors here are swallowed.
  await sleep(INTER_REQUEST_DELAY_MS, signal);
  let precise = rough;
  try {
    const half = w.precisionHalfWindowHours * MS_PER_HOUR;
    const refine = await fetchPositions(
      base,
      planet.code,
      {
        start: new Date(rough.date.getTime() - half),
        stop: new Date(rough.date.getTime() + half),
        step: w.precisionStep,
      },
      signal,
    );
    const refined = findFirstTransition(refine);
    if (refined !== null) precise = refined;
  } catch (e) {
    if (e instanceof ScanCancelledError) throw e;
    // Any other refinement error → keep the rough transition.
  }

  position.nextChange = { date: precise.date, toSector: precise.toSector };
  return position;
}
