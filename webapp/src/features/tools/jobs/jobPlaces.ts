/**
 * Places (spec §3.5, section 2): astro (APM) and zone names, and the pickup
 * places the filter offers, grouped by astro (astnum). A zone is named by the
 * owner's table (ZONE_LABELS) when it lists it, else by its most frequent
 * non-null name in the data, so spelling variants ("Docking Port" ×5 /
 * "Docking Bay" ×1) collapse into one entry. Computed once per loaded
 * dataset; kept pure for unit tests.
 *
 * Place keys (stored in the filter, the URL and localStorage):
 * - `ast:{astnum}` - every zone of that astro;
 * - `zone:{astnum}:{zone}` - one zone.
 */

import { coordsLabel, type Job, type JobLocation } from './jobModel';

/**
 * Astro (APM) names by astnum, from the owner's list - not exhaustive, to be
 * completed by the owner (501 Io is attested in jobs.json). Anything missing
 * renders as `Astro {astnum}`.
 */
export const ASTNUM_LABELS: Readonly<Record<number, string>> = {
  // Mercury system (1xx)
  100: 'Mercury',
  106: 'Mercury Station',
  // Venus system (2xx)
  200: 'Venus',
  // Earth system (3xx)
  300: 'Earth Orbit',
  301: 'Luna',
  302: 'Nerva Beacon',
  306: 'Earth Station',
  355: 'Ratropia',
  356: 'Rankle River',
  // Mars system (4xx)
  400: 'Mars',
  401: 'Phobos',
  402: 'Deimos',
  406: 'Mars Station',
  // Jupiter system (5xx)
  500: 'Jupiter',
  501: 'Io',
  506: 'Jupiter Station',
  // Outer systems
  600: 'Saturn',
  700: 'Uranus',
  800: 'Neptune',
  806: 'Neptune Station',
  // Oort cloud
  174310223: 'Oort Station',
  168940424: 'Kirsch 57 Asteroid',
  110000666: 'Velvet Asteroid',
};

/** The nine zones every station has. */
const STATION_ZONES: Readonly<Record<number, string>> = {
  51: 'Command Nexus',
  52: 'Habitation Hub',
  53: 'Research Ring',
  54: 'Engineering Bay',
  55: 'Docking Port',
  56: 'Observation Deck',
  57: 'Medical Module',
  58: 'Storage Sector',
  59: 'Life Support System',
};

/**
 * Authoritative zone names by astnum then zone, from the owner (they win over
 * the names found in the data). Not exhaustive - to be completed by the owner.
 */
export const ZONE_LABELS: Readonly<Record<number, Readonly<Record<number, string>>>> = {
  106: STATION_ZONES,
  206: STATION_ZONES,
  306: STATION_ZONES,
  406: STATION_ZONES,
  466: STATION_ZONES,
  506: STATION_ZONES,
  806: STATION_ZONES,
  174310223: STATION_ZONES,
  301: {
    5: 'Copperclaw Canyon (Aristoteles)',
    7: 'Luna Mesa Mart / Moonhowl Mesa (Endymion)',
  },
  355: {
    54: 'Imperious Falls',
    55: 'Area55 North',
    62: 'Vault of Webs',
    68: 'Town Hall',
    80: 'Tavern',
    112: "Queen's Quarry",
  },
};

/** The owner's name for a zone, if listed. */
export function zoneLabel(astnum: number, zone: number): string | null {
  return ZONE_LABELS[astnum]?.[zone] ?? null;
}

/** Display label that always carries the number: `Luna · 301`, `Astro 9`. */
export function astroLabel(astnum: number): string {
  const name = ASTNUM_LABELS[astnum];
  return name === undefined ? `Astro ${astnum}` : `${name} · ${astnum}`;
}

/** `{astro} · {zone name}`, or just the zone name when it already names the astro ("Luna Space"). */
function withAstro(astro: string, zoneName: string): string {
  return zoneName.toLowerCase().includes(astro.toLowerCase()) ? zoneName : `${astro} · ${zoneName}`;
}

/**
 * A job location's name: the owner's zone name, else the job's own; prefixed
 * by the astro name when known (`Jupiter Station · Docking Port`). Null when
 * nothing names it.
 */
export function locationName(loc: JobLocation): string | null {
  const zone = zoneLabel(loc.astnum, loc.zone) ?? loc.name;
  const astro = ASTNUM_LABELS[loc.astnum];
  if (astro === undefined) return zone;
  return zone === null ? astro : withAstro(astro, zone);
}

/** `{name} ({astnum} · z{zone})` (§3.4), or the coordinates alone. */
export function locationDisplayLabel(loc: JobLocation): string {
  const name = locationName(loc);
  return name === null ? coordsLabel(loc) : `${name} (${coordsLabel(loc)})`;
}

/** A zone place key's label: `Jupiter Station · Docking Port`, `Astro 9 · Zone 2`. */
function zonePlaceLabel(astnum: number, zoneName: string): string {
  const astro = ASTNUM_LABELS[astnum];
  return astro === undefined ? `Astro ${astnum} · ${zoneName}` : withAstro(astro, zoneName);
}

export function astroKey(astnum: number): string {
  return `ast:${astnum}`;
}

export function zoneKey(astnum: number, zone: number): string {
  return `zone:${astnum}:${zone}`;
}

export interface ParsedPlace {
  astnum: number;
  /** null = the whole astro. */
  zone: number | null;
}

const AST_KEY_RE = /^ast:(-?\d+)$/;
const ZONE_KEY_RE = /^zone:(-?\d+):(-?\d+)$/;

/** Parses a place key; anything malformed → null. */
export function parsePlaceKey(key: string): ParsedPlace | null {
  const ast = AST_KEY_RE.exec(key);
  if (ast !== null) return { astnum: Number(ast[1]), zone: null };
  const zone = ZONE_KEY_RE.exec(key);
  if (zone !== null) return { astnum: Number(zone[1]), zone: Number(zone[2]) };
  return null;
}

/** Whether `loc` lies inside the parsed place. */
export function placeContains(place: ParsedPlace, loc: JobLocation): boolean {
  return loc.astnum === place.astnum && (place.zone === null || loc.zone === place.zone);
}

export interface PlaceZone {
  key: string;
  astnum: number;
  zone: number;
  /** ZONE_LABELS name, else the most frequent name (`Zone {zone}` when never named); suffixed ` · z{zone}` when two zones of the astro share it. */
  name: string;
  /** Pickups in the whole dataset (no filter applied). */
  total: number;
}

export interface PlaceAstro {
  key: string;
  astnum: number;
  label: string;
  total: number;
  /** Zones by total pickups desc, then name. */
  zones: PlaceZone[];
}

export interface PlacesIndex {
  /** Astros by total pickups desc, then astnum. */
  astros: PlaceAstro[];
  /** Every valid place key → its human label (`Luna · 301`, `Jupiter Station · Docking Port`). */
  labels: ReadonlyMap<string, string>;
  /** Zone key → the name the picker shows for it (no ` · z{zone}` suffix) - searchable (jobsLogic). */
  zoneNames: ReadonlyMap<string, string>;
}

/** Most frequent name; ties → alphabetical (plain code-point order, stable). */
function mostFrequentName(names: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of names) {
    if (count > bestCount || (count === bestCount && best !== null && name < best)) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function buildPlaces(jobs: readonly Job[]): PlacesIndex {
  const byAstro = new Map<number, { total: number; zones: Map<number, { total: number; names: Map<string, number> }> }>();
  for (const job of jobs) {
    const { astnum, zone, name } = job.pickupLocation;
    let astro = byAstro.get(astnum);
    if (astro === undefined) {
      astro = { total: 0, zones: new Map() };
      byAstro.set(astnum, astro);
    }
    astro.total++;
    let z = astro.zones.get(zone);
    if (z === undefined) {
      z = { total: 0, names: new Map() };
      astro.zones.set(zone, z);
    }
    z.total++;
    if (name !== null) z.names.set(name, (z.names.get(name) ?? 0) + 1);
  }

  const astros: PlaceAstro[] = [];
  const labels = new Map<string, string>();
  const zoneNames = new Map<string, string>();
  for (const [astnum, astro] of byAstro) {
    const label = astroLabel(astnum);
    const zones: PlaceZone[] = [...astro.zones].map(([zone, z]) => ({
      key: zoneKey(astnum, zone),
      astnum,
      zone,
      name: zoneLabel(astnum, zone) ?? mostFrequentName(z.names) ?? `Zone ${zone}`,
      total: z.total,
    }));
    for (const z of zones) zoneNames.set(z.key, z.name);
    // Several zones of one astro can share a name (355: six "Northshire"s) -
    // the zone number tells them apart.
    const seen = new Map<string, number>();
    for (const z of zones) seen.set(z.name, (seen.get(z.name) ?? 0) + 1);
    for (const z of zones) if ((seen.get(z.name) ?? 0) > 1) z.name = `${z.name} · z${z.zone}`;
    zones.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const key = astroKey(astnum);
    astros.push({ key, astnum, label, total: astro.total, zones });
    labels.set(key, label);
    for (const z of zones) labels.set(z.key, zonePlaceLabel(astnum, z.name));
  }
  astros.sort((a, b) => b.total - a.total || a.astnum - b.astnum);
  return { astros, labels, zoneNames };
}

/** Human label for a place key; falls back to the parsed coordinates. */
export function placeLabel(places: PlacesIndex | null, key: string): string {
  const known = places?.labels.get(key);
  if (known !== undefined) return known;
  const parsed = parsePlaceKey(key);
  if (parsed === null) return key;
  if (parsed.zone === null) return astroLabel(parsed.astnum);
  return zonePlaceLabel(parsed.astnum, zoneLabel(parsed.astnum, parsed.zone) ?? `Zone ${parsed.zone}`);
}
