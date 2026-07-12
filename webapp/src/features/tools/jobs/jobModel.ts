/**
 * Jobs data model (spec §3.1). `jobs.json` is an array of 371 job objects
 * (370 unique ids - id 30107301 appears twice). Every row is parsed
 * independently; malformed rows are silently skipped so one bad entry can't
 * kill the tool. Fields the app doesn't model are ignored (but must not crash
 * the parse).
 */

export interface JobMapRef {
  mapId: string;
  zoneId?: string;
}

export interface JobLocation {
  astnum: number;
  zone: number;
  /** Empty/whitespace-only names parse to null. Equality ignores the name. */
  name: string | null;
}

export interface Job {
  id: number;
  factionRep: string | null;
  factionRival: string | null;
  requiredRep: number;
  requiredSkill: string | null;
  requiredSkillAmt: number;
  requiredTag: string | null;
  /** Original casing, for display. */
  typeRaw: string;
  /** Lowercased canonical type, for filtering. */
  type: string;
  risk: number;
  bonus: number;
  pickupLocation: JobLocation;
  dropoffLocation: JobLocation;
  /** Canonicalised reward key (see canonicalReward). */
  reward: string;
  rewardFunction: string | null;
  allyFunction: string | null;
  rivalFunction: string | null;
  capacity: number;
  ship: string | null;
  description: string;
  onComplete: string;
  /** Dormant cross-link to the maps area; null in shipped data. */
  mapRef: JobMapRef | null;
  // Derived flags (§3.1).
  isCargoJob: boolean;
  isOnSite: boolean;
  hasRival: boolean;
  isPlaceholderType: boolean;
}

/** `"{astnum} · z{zone}"`, e.g. `355 · z35`. */
export function coordsLabel(loc: JobLocation): string {
  return `${loc.astnum} · z${loc.zone}`;
}

/** name == null ? coordsLabel : `"{name} ({astnum} · z{zone})"`. */
export function locationLabel(loc: JobLocation): string {
  return loc.name === null ? coordsLabel(loc) : `${loc.name} (${coordsLabel(loc)})`;
}

/** Location equality by (astnum, zone) only - the name is ignored. */
export function sameLocation(a: JobLocation, b: JobLocation): boolean {
  return a.astnum === b.astnum && a.zone === b.zone;
}

/**
 * Reward canonicalisation (§3.1). Map by `rewardFunction` first; if the
 * function is unknown/null fall back to `raw.trim().toLowerCase()` with the
 * scrp/enrgy/nrg fixups.
 */
const REWARD_FUNCTION_MAP: Record<string, string> = {
  addCoinAmt: 'coin',
  addCarryCoinAmt: 'coin',
  addScrpAmt: 'scrap',
  addEnergyAmt: 'energy',
  addTitaniumAmt: 'titanium',
  addRocksAmt: 'rocks',
  addMalaAmt: 'mala',
  addWackoAmt: 'wackos',
  addMapDataAmt: 'data',
  addOilAmt: 'oil',
  addKryptonAmt: 'krypton',
  addStarTarAmt: 'star_tar',
  addStimnxAmt: 'stimnx',
  addSuppliesAmt: 'supplies',
  addTungstenAmt: 'wolfram',
  addUnobtainiumAmt: 'unobtainium',
  addGoldAmt: 'aurum',
};

export function canonicalReward(raw: string, rewardFunction: string | null): string {
  if (rewardFunction !== null && rewardFunction in REWARD_FUNCTION_MAP) {
    return REWARD_FUNCTION_MAP[rewardFunction]!;
  }
  const r = raw.trim().toLowerCase();
  if (r === 'scrp') return 'scrap';
  if (r === 'enrgy' || r === 'nrg') return 'energy';
  return r;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseLocation(value: unknown): JobLocation | null {
  if (value === null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.astnum !== 'number' || typeof obj.zone !== 'number') return null;
  const rawName = typeof obj.name === 'string' ? obj.name : null;
  const name = rawName !== null && rawName.trim().length > 0 ? rawName : null;
  return { astnum: obj.astnum, zone: obj.zone, name };
}

function parseMapRef(value: unknown): JobMapRef | null {
  if (value === null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.mapId !== 'string') return null;
  return { mapId: obj.mapId, ...(typeof obj.zoneId === 'string' ? { zoneId: obj.zoneId } : {}) };
}

/** Parses a single row; returns null for a malformed entry (skipped). */
export function parseJob(entry: unknown): Job | null {
  if (entry === null || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  if (typeof obj.id !== 'number') return null;
  const pickupLocation = parseLocation(obj.pickupLocation);
  const dropoffLocation = parseLocation(obj.dropoffLocation);
  if (pickupLocation === null || dropoffLocation === null) return null;

  const typeRaw = asString(obj.type, '???');
  const type = typeRaw.toLowerCase();
  const rewardFunction = asNullableString(obj.rewardFunction);
  const reward = canonicalReward(asString(obj.reward, ''), rewardFunction);
  const capacity = asNumber(obj.capacity, 0);
  const factionRival = asNullableString(obj.factionRival);

  return {
    id: obj.id,
    factionRep: asNullableString(obj.factionRep),
    factionRival,
    requiredRep: asNumber(obj.requiredRep, 0),
    requiredSkill: asNullableString(obj.requiredSkill),
    requiredSkillAmt: asNumber(obj.requiredSkillAmt, 0),
    requiredTag: asNullableString(obj.requiredTag),
    typeRaw,
    type,
    risk: asNumber(obj.risk, 0),
    bonus: asNumber(obj.bonus, 0),
    pickupLocation,
    dropoffLocation,
    reward,
    rewardFunction,
    allyFunction: asNullableString(obj.allyFunction),
    rivalFunction: asNullableString(obj.rivalFunction),
    capacity,
    ship: asNullableString(obj.ship),
    description: asString(obj.description, ''),
    onComplete: asString(obj.onComplete, ''),
    mapRef: parseMapRef(obj.mapRef),
    isCargoJob: capacity > 0,
    isOnSite: sameLocation(pickupLocation, dropoffLocation),
    hasRival: factionRival !== null,
    isPlaceholderType: type === '???',
  };
}

/**
 * Parses the whole file (§3.1). Must be a JSON array; each element must be an
 * object; bad rows are skipped, never thrown.
 */
export function parseJobsJson(raw: unknown): Job[] {
  if (!Array.isArray(raw)) return [];
  const jobs: Job[] = [];
  for (const entry of raw) {
    try {
      const job = parseJob(entry);
      if (job !== null) jobs.push(job);
    } catch {
      // Defensive: a single malformed row must not kill the tool.
    }
  }
  return jobs;
}
