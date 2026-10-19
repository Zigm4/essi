import { useEffect, useState } from 'react';
import { SHIP_RIGHTS, type ShipRight } from './roles';

/**
 * Ship catalog assets (spec §10). Two JSON files bundled under `public/catalog/`,
 * fetched once and cached. Each file loads independently; a fetch/parse failure
 * logs and falls back to an empty list (spec §10.3) - the UI then shows raw
 * fallbacks (everything groups under "Other", pickers show only the null rows).
 */

export interface ShipCatalogEntry {
  key: string;
  displayName: string;
  category: 'landcraft' | 'watercraft' | 'spacecraft' | null;
  prefix: string | null;
  crewSize: number | null;
  hullMax: number | null;
}

export type LocationGroup = 'landmarks' | 'stations' | 'bodies' | 'special' | 'custom';
export type ParamKind = 'zone' | 'spaceCoordinate' | null;

export interface ShipLocation {
  key: string;
  displayName: string;
  group: LocationGroup;
  subtitle: string | null;
  paramKind: ParamKind;
  defaultZone: number | null;
  isSpacecraftDefault: boolean;
}

export interface CatalogData {
  models: ShipCatalogEntry[];
  locations: ShipLocation[];
  modelByKey: Map<string, ShipCatalogEntry>;
  locationByKey: Map<string, ShipLocation>;
}

/** Category bucket order for the list + model picker (spec §5.2 / §7.1). */
export const CATEGORY_ORDER: Array<'landcraft' | 'watercraft' | 'spacecraft'> = [
  'landcraft',
  'watercraft',
  'spacecraft',
];

/** Location group order for the location picker (spec §7.2). */
export const LOCATION_GROUP_ORDER: LocationGroup[] = [
  'landmarks',
  'stations',
  'bodies',
  'special',
  'custom',
];

/** Constant custom-location key (spec §9.3). */
export const CUSTOM_LOCATION_KEY = 'other';

/** EVIL easter-egg constants (spec §6.7). */
export const EVIL = {
  prefix: 'EVIL',
  instanceNumber: '01',
  identifier: 'EVIL-01',
  ownerLabel: 'East-Shire',
  defaultLocationKey: 'east-shire',
} as const;

/** `hasPrefix` derived flag (spec §9.2): trimmed prefix non-empty. */
export function hasPrefix(entry: ShipCatalogEntry | null | undefined): boolean {
  return entry != null && entry.prefix != null && entry.prefix.trim().length > 0;
}

/** True for the void ship (prefix `EVIL`). */
export function isEvilEntry(entry: ShipCatalogEntry | null | undefined): boolean {
  return entry != null && entry.prefix === EVIL.prefix;
}

/**
 * `availableRoles` (spec §9.2): crewSize null → all 12 seats; ≤ 0 → none;
 * else the first `crewSize` seats in seat order.
 */
export function availableRoles(entry: ShipCatalogEntry | null | undefined): ShipRight[] {
  if (entry == null || entry.crewSize == null) return [...SHIP_RIGHTS];
  if (entry.crewSize <= 0) return [];
  return SHIP_RIGHTS.slice(0, entry.crewSize);
}

function buildCatalog(models: ShipCatalogEntry[], locations: ShipLocation[]): CatalogData {
  return {
    models,
    locations,
    modelByKey: new Map(models.map((m) => [m.key, m])),
    locationByKey: new Map(locations.map((l) => [l.key, l])),
  };
}

/** `null` when the file couldn't be loaded (so the caller can retry later). */
async function fetchJson<T>(file: string): Promise<T[] | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (err) {
    // Spec §10.3: log and fall back to an empty list.
    console.error(`Failed to load ${file}:`, err);
    return null;
  }
}

let catalogPromise: Promise<CatalogData> | null = null;

/**
 * Loads (and memoizes) both catalog files. Never rejects: a file that fails
 * falls back to an empty list, and a failed load is not memoized, so the next
 * call (e.g. back online) tries again.
 */
export function loadCatalogs(): Promise<CatalogData> {
  if (catalogPromise === null) {
    let failed = false;
    const attempt = (async () => {
      const [models, locations] = await Promise.all([
        fetchJson<ShipCatalogEntry>('catalog/ship_catalog.json'),
        fetchJson<ShipLocation>('catalog/ship_locations.json'),
      ]);
      failed = models === null || locations === null;
      return buildCatalog(models ?? [], locations ?? []);
    })();
    catalogPromise = attempt;
    void attempt.then(() => {
      if (failed && catalogPromise === attempt) catalogPromise = null;
    });
  }
  return catalogPromise;
}

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; data: CatalogData }
  | { status: 'error' };

/** React hook: loading → ready (or error if the whole load throws). */
export function useCatalogs(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    loadCatalogs().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
