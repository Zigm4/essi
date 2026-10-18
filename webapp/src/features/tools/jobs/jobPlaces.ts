/**
 * Pickup places (spec §3.5, section 2) - the jobs' pickup locations grouped by
 * astro (astnum). Each (astnum, zone) is named by its most frequent non-null
 * name, so spelling variants ("Docking Port" ×5 / "Docking Bay" ×1) collapse
 * into one entry. Computed once per loaded dataset; kept pure for unit tests.
 *
 * Place keys (stored in the filter, the URL and localStorage):
 * - `ast:{astnum}` - every zone of that astro;
 * - `zone:{astnum}:{zone}` - one zone.
 */

import type { Job, JobLocation } from './jobModel';

/**
 * Astro names by astnum. Only names attested in jobs.json are listed - the
 * owner can add more here; anything missing renders as `Astro {astnum}`.
 */
export const ASTNUM_LABELS: Readonly<Record<number, string>> = {
  100: 'Mercury',
  200: 'Venus',
  301: 'Luna',
  400: 'Mars',
  401: 'Phobos',
  501: 'Io',
  600: 'Saturn',
};

/** Display label that always carries the number: `Luna · 301`, `Astro 506`. */
export function astroLabel(astnum: number): string {
  const name = ASTNUM_LABELS[astnum];
  return name === undefined ? `Astro ${astnum}` : `${name} · ${astnum}`;
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
  /** Most frequent name (`Zone {zone}` when never named), suffixed ` · z{zone}` when two zones of the astro share it. */
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
  /** Every valid place key → its human label (`Luna · 301`, `Docking Port, Astro 506`). */
  labels: ReadonlyMap<string, string>;
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
  for (const [astnum, astro] of byAstro) {
    const label = astroLabel(astnum);
    const zones: PlaceZone[] = [...astro.zones].map(([zone, z]) => ({
      key: zoneKey(astnum, zone),
      astnum,
      zone,
      name: mostFrequentName(z.names) ?? `Zone ${zone}`,
      total: z.total,
    }));
    // Several zones of one astro can share a name (355: six "Northshire"s) -
    // the zone number tells them apart.
    const seen = new Map<string, number>();
    for (const z of zones) seen.set(z.name, (seen.get(z.name) ?? 0) + 1);
    for (const z of zones) if ((seen.get(z.name) ?? 0) > 1) z.name = `${z.name} · z${z.zone}`;
    zones.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const key = astroKey(astnum);
    astros.push({ key, astnum, label, total: astro.total, zones });
    labels.set(key, label);
    for (const z of zones) labels.set(z.key, `${z.name}, ${label}`);
  }
  astros.sort((a, b) => b.total - a.total || a.astnum - b.astnum);
  return { astros, labels };
}

/** Human label for a place key; falls back to the parsed coordinates. */
export function placeLabel(places: PlacesIndex | null, key: string): string {
  const known = places?.labels.get(key);
  if (known !== undefined) return known;
  const parsed = parsePlaceKey(key);
  if (parsed === null) return key;
  return parsed.zone === null ? astroLabel(parsed.astnum) : `Zone ${parsed.zone}, ${astroLabel(parsed.astnum)}`;
}
