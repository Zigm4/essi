import { NetworkError } from '../../../core/errors';
import type { TrackedObject } from './catalog';
import { findCatalogMatch } from './catalog';
import {
  TrackerAmbiguousError,
  TrackerApiMessageError,
  TrackerCancelledError,
  TrackerHttpError,
  TrackerMpcLookupError,
  TrackerNoEphemerisError,
  TrackerNotFoundError,
  TrackerOfflineError,
  TrackerUnparseableError,
  type TrackChoice,
} from './errors';
import { HorizonsFormatError, parseHorizonsEphemeris } from './horizonsParser';
import { jplRequest } from './jplClient';
import { isMajorKind, type TrackKind, type TrackerResult } from './models';
import { findMajorBody, majorBodyFromId, majorBodyId } from './majorBodies';
import { extractSbdbPdes, type ObjectKind } from './sbdb';
import { computeTrackerMetrics } from './sectorMath';

/**
 * Object Tracker pipeline (tools-live spec §6.6): resolve a canonical MPC
 * designation (4 tiers, network only at tier 3), then fetch Horizons vectors
 * for now → yesterday → tomorrow until one returns a position.
 */

export interface TrackTarget {
  name: string;
  kind: TrackKind;
  /** MPC designation, or `jpl:<id>` for a planet / moon. */
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

/**
 * Build the Horizons COMMAND from a resolved mpcID (spec §6.6).
 * Comets go through `DES=…;CAP;NOFRAG` (current apparition, no fragments): a
 * bare `1P` or `2P` is read by Horizons as a body number and lands on Pluto's
 * moons Kerberos / Styx, and `67P` returns a list instead of an ephemeris
 * (checked on the live API, Oct 2026). `C/2024 G3` → `DES=2024 G3;CAP;NOFRAG`.
 */
export function buildCommandID(mpcID: string, kind: ObjectKind): string {
  // A bare number is a small-body number only with ';' - without it Horizons
  // reads a major-body id ('1' → Mercury barycenter, '301' → the Moon), even
  // when Comets is selected.
  if (isAllDigits(mpcID.trim())) return `${mpcID.trim()};`;
  if (kind === 'comet') {
    const designation = stripTrailingParenthetical(mpcID.trim().replace(/^[cp]\//i, '')).replace(
      /^(\d+[PDI](?:-[A-Z]+)?)\/.*$/i, // "1P/Halley" → "1P"
      '$1',
    );
    return `DES=${designation};CAP;NOFRAG`;
  }
  return mpcID.trim();
}

// --- Horizons small-body index replies ----------------------------------------

const MAX_CHOICES = 12;

function choiceKind(designation: string): ObjectKind {
  return /^(\d+[PDI](-[A-Z]+)?$|[CPDXI]\/)/.test(designation) ? 'comet' : 'asteroid';
}

/** Up to 12 distinct objects (by designation, in order) and the count left out. */
export function limitChoices(all: readonly TrackChoice[]): { choices: TrackChoice[]; more: number } {
  const seen = new Set<string>();
  const unique: TrackChoice[] = [];
  for (const c of all) {
    const key = c.mpcID.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return { choices: unique.slice(0, MAX_CHOICES), more: Math.max(0, unique.length - MAX_CHOICES) };
}

/**
 * Horizons answers a name it can't pin down with a "Small-body Index Search
 * Results" page instead of an ephemeris: either "No matches found." or a
 * "Matching small-bodies" table (Record # / Epoch-yr / Primary Desig / name;
 * checked on the live API, Oct 2026). Returns null for any other reply.
 */
export function parseHorizonsIndexSearch(
  result: string,
): { kind: 'none' } | { kind: 'choices'; choices: TrackChoice[]; more: number } | null {
  if (!/Index Search Results|Matching small-bodies|Multiple major-bodies match/i.test(result)) return null;
  if (/No matches found/i.test(result)) return { kind: 'none' };
  const lines = result.split(/\r?\n/);
  const dashIndex = lines.findIndex((l) => /^\s*-{4,}(\s+-{4,})+\s*$/.test(l));
  if (dashIndex < 1) return { kind: 'choices', choices: [], more: 0 };
  // Column spans come from the dash runs; names from the header above them.
  const spans: [number, number][] = [];
  const dashes = lines[dashIndex]!;
  for (const m of dashes.matchAll(/-+/g)) spans.push([m.index, m.index + m[0].length]);
  const header = lines[dashIndex - 1]!;
  const cell = (line: string, i: number): string => {
    const [start] = spans[i]!;
    const end = i + 1 < spans.length ? spans[i + 1]![0] : line.length;
    return line.slice(start, end).trim();
  };
  const names = spans.map((_, i) => cell(header, i).toLowerCase());
  const desigCol = names.findIndex((n) => n.includes('primary desig') || n.includes('designation'));
  const nameCol = names.findIndex((n) => n.includes('match name') || n === 'name');
  const all: TrackChoice[] = [];
  for (const line of lines.slice(dashIndex + 1)) {
    if (line.trim().length === 0 || /^\s*\(/.test(line) || line.startsWith('*')) break;
    const designation = desigCol >= 0 ? cell(line, desigCol) : '';
    const name = nameCol >= 0 ? cell(line, nameCol) : '';
    if (designation.length === 0) continue;
    all.push({
      label: name.length > 0 && name !== designation ? `${name} (${designation})` : designation,
      mpcID: designation,
      kind: choiceKind(designation),
    });
  }
  // Newest apparition last in Horizons' list; the dedupe keeps one per object.
  return { kind: 'choices', ...limitChoices(all) };
}

/** SBDB HTTP 300 `list` entries of the requested kind. */
export function sbdbChoices(json: unknown, kind: ObjectKind): TrackChoice[] {
  if (typeof json !== 'object' || json === null) return [];
  const list = (json as Record<string, unknown>).list;
  if (!Array.isArray(list)) return [];
  const out: TrackChoice[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const pdes = typeof e.pdes === 'string' ? e.pdes : '';
    const name = typeof e.name === 'string' ? e.name : pdes;
    // Non-periodic comets list a bare pdes ('2015 X7'); the name has the 'C/'.
    const entryKind: ObjectKind = /^(\d+[PDI]|[CPDXI])\//.test(name) ? 'comet' : choiceKind(pdes);
    if (pdes.length === 0 || entryKind !== kind) continue;
    out.push({ label: name, mpcID: pdes, kind });
  }
  return out;
}

// --- Tier 1..4 resolution ----------------------------------------------------

export type SbdbLookupFn = (query: string, kind?: ObjectKind) => Promise<string | null>;

/**
 * Resolve the canonical MPC designation. `lookup` performs the SBDB sstr call
 * (tier 3) and is injected so the tier logic is unit-testable offline.
 * @throws TrackerMpcLookupError when no strategy resolves the target.
 */
export async function resolveMPC(
  target: TrackTarget & { kind: ObjectKind },
  catalog: readonly TrackedObject[],
  lookup: SbdbLookupFn,
): Promise<string> {
  // Tier 0 - prefilled MPC id.
  if (target.mpcID !== undefined && target.mpcID.trim().length > 0) return target.mpcID.trim();

  // Tier 1 - exact catalog match on the raw name.
  const catalogHit = findCatalogMatch(catalog, target.name);
  if (catalogHit !== null) return catalogHit.identifier;

  // Normalize the name for the remaining tiers.
  const cleaned = stripWrappingParens(target.name);
  if (cleaned.length === 0) throw new TrackerMpcLookupError();

  // Tier 2 - numbered-asteroid shortcut.
  if (target.kind === 'asteroid' && isAllDigits(cleaned)) return cleaned;

  // Tier 3 - SBDB sstr lookup, with a parenthetical-stripped retry.
  let hit = await lookup(cleaned, target.kind);
  if (hit === null && hasTrailingParenthetical(cleaned)) {
    hit = await lookup(stripTrailingParenthetical(cleaned), target.kind);
  }
  if (hit !== null && hit.length > 0) return hit;

  // Tier 4 - designation passthrough (needs both a digit and a letter).
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
  return async (query: string, kind?: ObjectKind): Promise<string | null> => {
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
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return null;
      }
      if (status === 300 && kind !== undefined) {
        const { choices, more } = limitChoices(sbdbChoices(json, kind));
        if (choices.length > 1) throw new TrackerAmbiguousError(choices, more);
      }
      return extractSbdbPdes(json, kind);
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
const MS_PER_HOUR = 3_600_000;

function fmtMinute(d: Date): string {
  return `${fmtDay(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

interface VectorWindow {
  start: string;
  stop: string;
  step: string;
}

/**
 * The position right now (to the minute), then yesterday's and tomorrow's at
 * 00:00 UTC for a body whose ephemeris doesn't cover now. It used to be today
 * at 00:00 UTC, shown as today - up to a day old, and the previous day west of
 * UTC.
 */
export function candidateWindows(now: Date = new Date()): VectorWindow[] {
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = (t: number): VectorWindow => ({
    start: fmtDay(new Date(t)),
    stop: fmtDay(new Date(t + MS_PER_DAY)),
    step: '1d',
  });
  return [
    { start: fmtMinute(minute), stop: fmtMinute(new Date(minute.getTime() + MS_PER_HOUR)), step: '1h' },
    day(today - MS_PER_DAY),
    day(today + MS_PER_DAY),
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

/** Returns the first position in a candidate window, or null to try the next one. */
async function fetchVectors(
  base: string,
  commandID: string,
  window: VectorWindow,
  signal: AbortSignal | undefined,
): Promise<{ x: number; y: number; z: number; date: Date } | null> {
  const params: Record<string, string> = {
    format: 'json',
    COMMAND: `'${commandID}'`,
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    OUT_UNITS: "'KM-S'",
    START_TIME: `'${window.start}'`,
    STOP_TIME: `'${window.stop}'`,
    STEP_SIZE: `'${window.step}'`,
    // Position only (no velocity / light-time lines).
    VEC_TABLE: "'1'",
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

  const search = parseHorizonsIndexSearch(result);
  if (search !== null) {
    if (search.kind === 'none' || search.choices.length === 0) throw new TrackerNotFoundError();
    throw new TrackerAmbiguousError(search.choices, search.more);
  }

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

/**
 * Full tracking pipeline: resolve → fetch. A planet or moon skips the SBDB
 * lookup and goes to Horizons with its own id (`'502'`, no ';' - the ';'
 * would make it a small-body number).
 */
export async function track(
  base: string,
  target: TrackTarget,
  catalog: readonly TrackedObject[],
  signal?: AbortSignal,
): Promise<TrackerResult> {
  let mpcID: string;
  let commandID: string;
  if (isMajorKind(target.kind)) {
    const body = majorBodyFromId(target.mpcID ?? '') ?? findMajorBody(target.name);
    if (body === null || body.type === 'star') throw new TrackerMpcLookupError();
    mpcID = majorBodyId(body);
    commandID = String(body.naif);
  } else {
    const kind: ObjectKind = target.kind;
    mpcID = await resolveMPC({ ...target, kind }, catalog, makeSbdbLookup(base, signal));
    commandID = buildCommandID(mpcID, kind);
  }

  for (const window of candidateWindows()) {
    const sample = await fetchVectors(base, commandID, window, signal);
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
