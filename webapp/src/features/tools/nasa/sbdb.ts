/**
 * NASA SBDB parsing + the local status classification shared by Discoveries
 * (bulk query) and Tracker (single-body lookup). Spec §5.4, §5.5, §6.6.
 */

export type ObjectKind = 'comet' | 'asteroid';
export type DiscoveryStatus = 'ok' | 'caution' | 'danger' | 'unknown';

export interface DiscoveredObject {
  /** pdes - required (rows without it are dropped). */
  designation: string;
  /** full_name, kept raw; falls back to designation. */
  fullName: string;
  firstObs?: string;
  lastObs?: string;
  isHazardous: boolean;
  diameterMeters?: number;
  albedo?: number;
  kind: ObjectKind;
}

// --- Cell decoding (tolerant: string | number | null; '' counts as null) -----

function stringCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.length === 0 ? null : v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  return null;
}

function numberCell(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    if (v.length === 0) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// --- Query-response parsing (§5.4) -------------------------------------------

interface SbdbQueryShape {
  fields: string[];
  data: unknown[][];
}

function asQueryShape(json: unknown): SbdbQueryShape | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;
  const fields = obj.fields;
  const data = obj.data;
  if (!Array.isArray(fields) || !fields.every((f) => typeof f === 'string')) return null;
  if (!Array.isArray(data)) return null;
  return { fields: fields as string[], data: data as unknown[][] };
}

/** '' sorts first - missing first_obs bubbles to the top (matches the bot). */
function obsSortKey(o: DiscoveredObject): string {
  return o.firstObs ?? '';
}

/**
 * Parse an SBDB bulk-query response into typed objects.
 * - column names are read from `fields` (never positional-assumed)
 * - diameter arrives in km → converted to metres (×1000)
 * - rows without pdes are dropped
 * - sorted ascending by first_obs
 */
export function parseSbdbObjects(json: unknown, kind: ObjectKind): DiscoveredObject[] {
  const shape = asQueryShape(json);
  if (shape === null) return [];
  const index: Record<string, number> = {};
  shape.fields.forEach((name, i) => {
    index[name] = i;
  });
  const cell = (row: unknown[], name: string): unknown => {
    const i = index[name];
    return i === undefined ? undefined : row[i];
  };

  const out: DiscoveredObject[] = [];
  for (const row of shape.data) {
    if (!Array.isArray(row)) continue;
    const designation = stringCell(cell(row, 'pdes'));
    if (designation === null) continue;
    const fullName = stringCell(cell(row, 'full_name')) ?? designation;
    const firstObs = stringCell(cell(row, 'first_obs')) ?? undefined;
    const lastObs = stringCell(cell(row, 'last_obs')) ?? undefined;
    const pha = stringCell(cell(row, 'pha'));
    const diameterKm = numberCell(cell(row, 'diameter'));
    const albedo = numberCell(cell(row, 'albedo'));
    out.push({
      designation,
      fullName,
      firstObs,
      lastObs,
      isHazardous: pha === 'Y',
      diameterMeters: diameterKm === null ? undefined : diameterKm * 1000,
      albedo: albedo === null ? undefined : albedo,
      kind,
    });
  }
  out.sort((a, b) => obsSortKey(a).localeCompare(obsSortKey(b)));
  return out;
}

// --- Historical (pre-1900) client-side filter (§5.4) -------------------------

/** Date part of an obs string if it parses as YYYY-MM-DD, else null. */
function obsDatePart(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return m === null ? null : m[0]!;
}

/**
 * Keep rows whose first_obs parses and falls inside [startYmd, endYmd]
 * (inclusive). Rows with missing/unparseable first_obs are dropped. ISO
 * date strings compare correctly lexicographically.
 */
export function filterHistorical(
  objects: DiscoveredObject[],
  startYmd: string,
  endYmd: string,
): DiscoveredObject[] {
  return objects.filter((o) => {
    const d = obsDatePart(o.firstObs);
    return d !== null && d >= startYmd && d <= endYmd;
  });
}

// --- Domain helpers (§5.5) ---------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** Strip a single pair of wrapping parens; fall back to designation. */
export function displayNameOf(o: DiscoveredObject): string {
  let name = o.fullName.trim();
  if (name.startsWith('(') && name.endsWith(')') && name.length >= 2) {
    name = name.slice(1, -1).trim();
  }
  return name.length === 0 ? o.designation : name;
}

function parseObsMs(raw: string | undefined): number | null {
  const part = obsDatePart(raw);
  if (part === null) return null;
  const [y, m, d] = part.split('-').map((s) => Number.parseInt(s, 10));
  const t = Date.UTC(y!, m! - 1, d!);
  return Number.isNaN(t) ? null : t;
}

/** floor(lastObs − firstObs) in days, or null unless both parse. */
export function trackingPeriodDays(o: DiscoveredObject): number | null {
  const first = parseObsMs(o.firstObs);
  const last = parseObsMs(o.lastObs);
  if (first === null || last === null) return null;
  return Math.floor((last - first) / MS_PER_DAY);
}

/**
 * Local status classification (top-down, first match wins). Mirrors the bot's
 * `calculate_status`. Note: the getter never returns `unknown` - missing obs
 * dates yield days=0 → caution (spec §5.5 / open question #2, replicated).
 */
export function computeStatus(o: DiscoveredObject): DiscoveryStatus {
  if (o.isHazardous) return 'danger';
  if (o.kind === 'asteroid' && (o.diameterMeters ?? 0) > 140) return 'caution';
  if ((trackingPeriodDays(o) ?? 0) < 3) return 'caution';
  return 'ok';
}

export function statusLabel(status: DiscoveryStatus): string {
  switch (status) {
    case 'ok':
      return 'Within normal parameters';
    case 'caution':
      return 'Short tracking window';
    case 'danger':
      return 'Potentially hazardous';
    case 'unknown':
      return 'Unclassified';
  }
}

/**
 * The status label with its actual reason: `caution` covers both a short
 * tracking window and a large asteroid, which statusLabel can't tell apart
 * (it said "Short tracking window" for a 500 m asteroid tracked for years).
 * Same order as statusExplanation.
 */
export function statusLabelOf(o: DiscoveredObject): string {
  if (o.isHazardous) return 'Potentially hazardous';
  if ((trackingPeriodDays(o) ?? 0) < 3) return 'Short tracking window';
  if (o.kind === 'asteroid' && (o.diameterMeters ?? 0) > 140) return 'Large body (over 140 m)';
  return 'Within normal parameters';
}

export function statusEmoji(status: DiscoveryStatus): string {
  switch (status) {
    case 'ok':
      return '🟢';
    case 'caution':
      return '🟡';
    case 'danger':
      return '🔴';
    case 'unknown':
      return '❓';
  }
}

/** Detail-sheet explanation - evaluated in a different order than the status. */
export function statusExplanation(o: DiscoveredObject): string {
  if (o.isHazardous) return 'Flagged as potentially hazardous (PHA=Y) by SBDB.';
  if ((trackingPeriodDays(o) ?? 0) < 3) {
    return 'Short tracking window - orbit refinement may still be in progress.';
  }
  if (o.kind === 'asteroid' && (o.diameterMeters ?? 0) > 140) {
    return 'Large diameter (>140 m). Worth watching.';
  }
  return 'Within normal parameters.';
}

export const KIND_EMOJI: Record<ObjectKind, string> = {
  comet: '☄',
  asteroid: '◯',
};

// --- Single-body lookup pdes extraction (§6.6) -------------------------------

/** A comet designation or name: `1P`, `73P-B`, `1P/Halley`, `C/2024 G3 (ATLAS)`, `P/2003 CP7`. */
function looksLikeComet(pdes: string, name: string): boolean {
  return /^\d+[PDI](-[A-Z]+)?$/.test(pdes) || /^(\d+[PDI]|[CPDXI])\//.test(name) || /^[CPDXI]\//.test(pdes);
}

/**
 * The designation from an SBDB `sstr` lookup.
 * - Single match (HTTP 200): `object.des` - the live API has no `pdes` there
 *   (checked Oct 2026 for Eros, Ceres, 1P, C/2024 G3); `object.pdes` is kept as
 *   a fallback. When `kind` is given, a match of the other kind (SBDB
 *   `object.kind` starts with `a` for asteroids, `c` for comets) is rejected.
 * - Ambiguous (HTTP 300): `list[].pdes`, keeping the first entry of the
 *   requested kind ("Halley" lists asteroid 2688 before comet 1P). Without a
 *   kind, the first entry.
 */
export function extractSbdbPdes(json: unknown, kind?: ObjectKind): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;
  const single = obj.object;
  if (typeof single === 'object' && single !== null) {
    const o = single as Record<string, unknown>;
    const des = typeof o.des === 'string' && o.des.length > 0 ? o.des : typeof o.pdes === 'string' ? o.pdes : '';
    if (des.length > 0) {
      const sbdbKind = typeof o.kind === 'string' ? o.kind : '';
      if (kind !== undefined && sbdbKind.length > 0 && !sbdbKind.startsWith(kind === 'comet' ? 'c' : 'a')) return null;
      return des;
    }
  }
  const list = obj.list;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const pdes = typeof e.pdes === 'string' ? e.pdes : '';
      if (pdes.length === 0) continue;
      if (kind === undefined) return pdes;
      const isComet = looksLikeComet(pdes, typeof e.name === 'string' ? e.name : '');
      if (isComet === (kind === 'comet')) return pdes;
    }
  }
  return null;
}

// --- DiscoveredObject JSON (history payloads, §5.8) --------------------------

export function discoveredObjectToJson(o: DiscoveredObject): Record<string, unknown> {
  return {
    designation: o.designation,
    fullName: o.fullName,
    firstObs: o.firstObs ?? null,
    lastObs: o.lastObs ?? null,
    isHazardous: o.isHazardous,
    diameterMeters: o.diameterMeters ?? null,
    albedo: o.albedo ?? null,
    kind: o.kind,
  };
}

export function discoveredObjectFromJson(json: unknown): DiscoveredObject | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const designation = typeof o.designation === 'string' ? o.designation : null;
  if (designation === null) return null;
  const kind: ObjectKind = o.kind === 'comet' ? 'comet' : 'asteroid';
  return {
    designation,
    fullName: typeof o.fullName === 'string' ? o.fullName : designation,
    firstObs: typeof o.firstObs === 'string' ? o.firstObs : undefined,
    lastObs: typeof o.lastObs === 'string' ? o.lastObs : undefined,
    isHazardous: o.isHazardous === true,
    diameterMeters: typeof o.diameterMeters === 'number' ? o.diameterMeters : undefined,
    albedo: typeof o.albedo === 'number' ? o.albedo : undefined,
    kind,
  };
}
