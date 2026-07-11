import { NetworkError } from '../../../core/errors';
import type { TrackedObject } from './catalog';
import { findCatalogMatch } from './catalog';
import {
  TrackerApiMessageError,
  TrackerCancelledError,
  TrackerHttpError,
  TrackerMpcLookupError,
  TrackerNoEphemerisError,
  TrackerOfflineError,
  TrackerUnparseableError,
} from './errors';
import { HorizonsFormatError, parseHorizonsEphemeris } from './horizonsParser';
import { jplRequest } from './jplClient';
import type { TrackerResult } from './models';
import { extractSbdbPdes, type ObjectKind } from './sbdb';
import { computeTrackerMetrics } from './sectorMath';

/**
 * Object Tracker pipeline (tools-live spec §6.6): resolve a canonical MPC
 * designation (4 tiers, network only at tier 3), then fetch Horizons vectors
 * for today → yesterday → tomorrow until one returns a position.
 */

export interface TrackTarget {
  name: string;
  kind: ObjectKind;
  mpcID?: string;
}

const TRACKER_TIMEOUT_MS = 30_000;

// --- Name normalization helpers ----------------------------------------------

/** Strip a single pair of wrapping parens. */
export function stripWrappingParens(name: string): string {
  const t = name.trim();
  if (t.length >= 2 && t.startsWith('(') && t.endsWith(')')) return t.slice(1, -1).trim();
  return t;
}

/** Remove a trailing ` (…)` parenthetical. */
export function stripTrailingParenthetical(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function hasTrailingParenthetical(name: string): boolean {
  return /\([^)]*\)\s*$/.test(name.trim());
}

function isAllDigits(s: string): boolean {
  return /^\d+$/.test(s);
}

function hasDigitAndLetter(s: string): boolean {
  return /\d/.test(s) && /[a-zA-Z]/.test(s);
}

/** Build the Horizons COMMAND designation from a resolved mpcID (spec §6.6). */
export function buildCommandID(mpcID: string, kind: ObjectKind): string {
  if (kind === 'comet') {
    const noPrefix = mpcID.replace(/^[cp]\//i, '');
    return stripTrailingParenthetical(noPrefix);
  }
  // asteroid: a bare number is the Ceres-vs-Mercury ambiguity → append ';'
  return isAllDigits(mpcID.trim()) ? `${mpcID.trim()};` : mpcID.trim();
}

// --- Tier 1..4 resolution ----------------------------------------------------

export type SbdbLookupFn = (query: string) => Promise<string | null>;

/**
 * Resolve the canonical MPC designation. `lookup` performs the SBDB sstr call
 * (tier 3) and is injected so the tier logic is unit-testable offline.
 * @throws TrackerMpcLookupError when no strategy resolves the target.
 */
export async function resolveMPC(
  target: TrackTarget,
  catalog: readonly TrackedObject[],
  lookup: SbdbLookupFn,
): Promise<string> {
  // Tier 0 — prefilled MPC id.
  if (target.mpcID !== undefined && target.mpcID.trim().length > 0) return target.mpcID.trim();

  // Tier 1 — exact catalog match on the raw name.
  const catalogHit = findCatalogMatch(catalog, target.name);
  if (catalogHit !== null) return catalogHit.identifier;

  // Normalize the name for the remaining tiers.
  const cleaned = stripWrappingParens(target.name);
  if (cleaned.length === 0) throw new TrackerMpcLookupError();

  // Tier 2 — numbered-asteroid shortcut.
  if (target.kind === 'asteroid' && isAllDigits(cleaned)) return cleaned;

  // Tier 3 — SBDB sstr lookup, with a parenthetical-stripped retry.
  let hit = await lookup(cleaned);
  if (hit === null && hasTrailingParenthetical(cleaned)) {
    hit = await lookup(stripTrailingParenthetical(cleaned));
  }
  if (hit !== null && hit.length > 0) return hit;

  // Tier 4 — designation passthrough (needs both a digit and a letter).
  if (hasDigitAndLetter(cleaned)) return cleaned;

  throw new TrackerMpcLookupError();
}

// --- SBDB single-body lookup (network) ---------------------------------------

/**
 * SBDB sstr lookup. Accepts 2xx and 3xx (HTTP 300 = ambiguous, body carries
 * `list`). 404 or a missing pdes → null (lets the next tier run). Offline /
 * timeout → TrackerOfflineError; other HTTP error → TrackerHttpError; any other
 * transport failure → null.
 */
export function makeSbdbLookup(base: string, signal: AbortSignal | undefined): SbdbLookupFn {
  return async (query: string): Promise<string | null> => {
    let status: number;
    let body: string;
    try {
      const res = await jplRequest(base, 'sbdb', { sstr: query }, {
        readTimeoutMs: TRACKER_TIMEOUT_MS,
        signal,
      });
      status = res.status;
      body = res.body;
    } catch (e) {
      if (e instanceof NetworkError) {
        if (e.kind === 'offline' || e.kind === 'timeout') throw new TrackerOfflineError();
        if (e.kind === 'cancelled') throw new TrackerCancelledError();
      }
      return null; // other transport failure → treat as "not found"
    }
    if (status === 404) return null;
    if (status >= 200 && status < 400) {
      try {
        return extractSbdbPdes(JSON.parse(body));
      } catch {
        return null;
      }
    }
    throw new TrackerHttpError(status);
  };
}

// --- Step 2: Horizons vectors with day retry ---------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmtDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const MS_PER_DAY = 86_400_000;

function candidateDays(): Date[] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return [
    today,
    new Date(today.getTime() - MS_PER_DAY),
    new Date(today.getTime() + MS_PER_DAY),
  ];
}

function mapTrackerNetworkError(e: unknown): never {
  if (e instanceof NetworkError) {
    if (e.kind === 'offline' || e.kind === 'timeout') throw new TrackerOfflineError();
    if (e.kind === 'cancelled') throw new TrackerCancelledError();
    if (e.kind === 'http') throw new TrackerHttpError(e.status ?? 0);
  }
  throw new TrackerUnparseableError();
}

/** Returns the first position for a candidate day, or null to try the next day. */
async function fetchVectorsForDay(
  base: string,
  commandID: string,
  day: Date,
  signal: AbortSignal | undefined,
): Promise<{ x: number; y: number; z: number; date: Date } | null> {
  const stop = new Date(day.getTime() + MS_PER_DAY);
  const params: Record<string, string> = {
    format: 'json',
    COMMAND: `'${commandID}'`,
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    OUT_UNITS: "'KM-S'",
    START_TIME: `'${fmtDay(day)}'`,
    STOP_TIME: `'${fmtDay(stop)}'`,
    STEP_SIZE: "'1d'",
  };
  let status: number;
  let body: string;
  try {
    const res = await jplRequest(base, 'horizons', params, {
      readTimeoutMs: TRACKER_TIMEOUT_MS,
      signal,
    });
    status = res.status;
    body = res.body;
  } catch (e) {
    mapTrackerNetworkError(e);
  }
  if (status < 200 || status >= 300) throw new TrackerHttpError(status);

  let result: string;
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    result = typeof json.result === 'string' ? json.result : '';
  } catch {
    throw new TrackerUnparseableError();
  }

  // Empty / "No ephemeris available" → land in the day-retry loop (spec §6.6).
  const trimmed = result.trim();
  if (trimmed.length === 0 || /no ephemeris/i.test(trimmed)) return null;

  let positions;
  try {
    positions = parseHorizonsEphemeris(result);
  } catch (e) {
    if (e instanceof HorizonsFormatError) throw new TrackerApiMessageError(e.preview);
    throw new TrackerUnparseableError();
  }
  if (positions.length === 0) return null;
  return positions[0]!;
}

/** Full tracking pipeline: resolve → fetch. */
export async function track(
  base: string,
  target: TrackTarget,
  catalog: readonly TrackedObject[],
  signal?: AbortSignal,
): Promise<TrackerResult> {
  const mpcID = await resolveMPC(target, catalog, makeSbdbLookup(base, signal));
  const commandID = buildCommandID(mpcID, target.kind);

  for (const day of candidateDays()) {
    const sample = await fetchVectorsForDay(base, commandID, day, signal);
    if (sample !== null) {
      const m = computeTrackerMetrics(sample.x, sample.y, sample.z);
      return {
        mpcID,
        displayName: target.name,
        kind: target.kind,
        xAU: m.xAU,
        yAU: m.yAU,
        zAU: m.zAU,
        sector: m.sector,
        distanceAU: m.distanceAU,
        slExact: m.slExact,
        slRounded: m.slRounded,
        slFloor: m.slFloor,
        timestamp: sample.date,
      };
    }
  }
  throw new TrackerNoEphemerisError();
}
