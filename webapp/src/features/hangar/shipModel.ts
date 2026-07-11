import type { ShipRow, TagRow } from '../../data/db';
import {
  CUSTOM_LOCATION_KEY,
  hasPrefix,
  type CatalogData,
  type ShipCatalogEntry,
  type ShipLocation,
} from './catalog';
import { ROLE_COLUMN, SHIP_RIGHTS, type ShipRight } from './roles';

/**
 * Domain object mirroring Flutter's `ShipModel` (spec §9.4). Built from a
 * `ShipRow` plus its resolved tags. `roles` holds all 12 seats (blank → null).
 */
export interface ShipModel {
  id: string;
  name: string;
  modelKey: string | null;
  customModelLabel: string | null;
  registered: boolean;
  locationKey: string | null;
  customLocation: string | null;
  locationZone: number | null;
  locationSector: string | null;
  locationSL: number | null;
  hull: number | null;
  roles: Record<ShipRight, string | null>;
  note: string;
  createdAt: number;
  updatedAt: number;
  tags: TagRow[];
}

/** The category buckets shown in the list (spec §5.2). */
export type ShipCategory = 'landcraft' | 'watercraft' | 'spacecraft' | 'other';

export function emptyRoles(): Record<ShipRight, string | null> {
  const out = {} as Record<ShipRight, string | null>;
  for (const r of SHIP_RIGHTS) out[r] = null;
  return out;
}

export function rowToShipModel(row: ShipRow, tags: TagRow[]): ShipModel {
  const roles = emptyRoles();
  for (const r of SHIP_RIGHTS) {
    const value = row[ROLE_COLUMN[r]];
    roles[r] = typeof value === 'string' ? value : null;
  }
  return {
    id: row.id,
    name: row.name,
    modelKey: row.modelKey,
    customModelLabel: row.customModelLabel,
    registered: row.registered,
    locationKey: row.locationKey,
    customLocation: row.customLocation,
    locationZone: row.locationZone,
    locationSector: row.locationSector,
    locationSL: row.locationSL,
    hull: row.hull,
    roles,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags,
  };
}

/** Everything Save composes (spec §6.6), minus id/timestamps handled by the repo. */
export interface ShipDraft {
  id: string;
  name: string;
  modelKey: string | null;
  customModelLabel: string | null;
  registered: boolean;
  locationKey: string | null;
  customLocation: string | null;
  locationZone: number | null;
  locationSector: string | null;
  locationSL: number | null;
  hull: number | null;
  roles: Record<ShipRight, string | null>;
  note: string;
}

/** Builds the persisted row from a draft (id + timestamps supplied by the repo). */
export function draftToShipRow(
  draft: ShipDraft,
  id: string,
  createdAt: number,
  updatedAt: number,
): ShipRow {
  const row: ShipRow = {
    id,
    name: draft.name,
    modelKey: draft.modelKey,
    customModelLabel: draft.customModelLabel,
    registered: draft.registered,
    locationKey: draft.locationKey,
    customLocation: draft.customLocation,
    locationZone: draft.locationZone,
    locationSector: draft.locationSector,
    locationSL: draft.locationSL,
    hull: draft.hull,
    pilotName: null,
    gunnerName: null,
    cartographerName: null,
    prospectorName: null,
    signallerName: null,
    technicianName: null,
    sentryName: null,
    fabricatorName: null,
    medicName: null,
    quartermasterName: null,
    chefName: null,
    alchemistName: null,
    note: draft.note,
    createdAt,
    updatedAt,
  };
  const roleCols = row as unknown as Record<string, string | null>;
  for (const r of SHIP_RIGHTS) {
    roleCols[ROLE_COLUMN[r]] = draft.roles[r];
  }
  return row;
}

// --- Name / prefix logic (spec §6.5) ----------------------------------------

/** Splits a stored `PREFIX-SUFFIX` name into its suffix (spec §6.5). */
export function extractSuffix(name: string, prefix: string): string {
  if (prefix === '') return '';
  if (name.startsWith(prefix + '-')) return name.slice(prefix.length + 1);
  if (name.startsWith(prefix)) {
    const rest = name.slice(prefix.length);
    return rest.startsWith('-') ? rest.slice(1) : rest;
  }
  return name;
}

/** Composes the full stored name from the current fields (spec §6.5). */
export function composedName(
  fields: { modelKey: string | null; suffixField: string; nameField: string },
  modelByKey: Map<string, ShipCatalogEntry>,
): string {
  const entry = fields.modelKey != null ? modelByKey.get(fields.modelKey) : undefined;
  if (entry != null && hasPrefix(entry)) {
    const suffix = fields.suffixField.trim();
    return suffix === '' ? '' : `${entry.prefix}-${suffix}`;
  }
  return fields.nameField.trim();
}

// --- List-card derivations --------------------------------------------------

/** Bucket a ship by its catalog model's category (spec §5.2). */
export function shipCategory(model: ShipModel, catalog: CatalogData | null): ShipCategory {
  if (catalog == null || model.modelKey == null) return 'other';
  const entry = catalog.modelByKey.get(model.modelKey);
  return entry?.category ?? 'other';
}

/**
 * Card model label (spec §5.3): `customModelLabel` if non-empty, else the
 * catalog entry's `displayName`, else null (row hidden).
 */
export function modelLabel(model: ShipModel, catalog: CatalogData | null): string | null {
  const custom = model.customModelLabel?.trim();
  if (custom != null && custom.length > 0) return custom;
  if (model.modelKey != null && catalog != null) {
    const entry = catalog.modelByKey.get(model.modelKey);
    if (entry != null) return entry.displayName;
  }
  return null;
}

/** Location display string for the list card (spec §12.4). */
export function locationDisplay(model: ShipModel, catalog: CatalogData | null): string | null {
  if (model.locationKey == null) return null;
  if (model.locationKey === CUSTOM_LOCATION_KEY) {
    const custom = model.customLocation?.trim();
    return custom != null && custom.length > 0 ? custom : null;
  }
  const entry = catalog?.locationByKey.get(model.locationKey);
  if (entry == null) return null;
  switch (entry.paramKind) {
    case 'zone': {
      const z = model.locationZone ?? entry.defaultZone ?? 55;
      return `${entry.displayName} · zone ${z}`;
    }
    case 'spaceCoordinate': {
      const sec = (model.locationSector ?? '').trim();
      const sl = model.locationSL != null ? model.locationSL.toString() : '?';
      if (sec === '') return `${entry.displayName} · ${sl} SL`;
      return `${entry.displayName} · ${sec}, ${sl} SL`;
    }
    default:
      return entry.displayName;
  }
}

export type HullTone = 'success' | 'warn' | 'danger';

/** Hull colour by ratio (spec §5.3). ratio counts as 0 when max is 0. */
export function hullTone(hull: number, hullMax: number): HullTone {
  const ratio = hullMax === 0 ? 0 : hull / hullMax;
  if (ratio >= 0.75) return 'success';
  if (ratio >= 0.4) return 'warn';
  return 'danger';
}

/** Assigned (role, name) pairs in seat order, blanks skipped (spec §9.4). */
export function assignedRoles(model: ShipModel): Array<{ right: ShipRight; name: string }> {
  const out: Array<{ right: ShipRight; name: string }> = [];
  for (const r of SHIP_RIGHTS) {
    const raw = model.roles[r];
    const name = raw?.trim() ?? '';
    if (name.length > 0) out.push({ right: r, name });
  }
  return out;
}

// --- Sorting / grouping (spec §12.1 / §12.5) --------------------------------

/** Sort by name, case-insensitive, ascending (spec §12.1). */
export function sortShips(ships: ShipModel[]): ShipModel[] {
  return [...ships].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
}

export interface ShipGroup {
  category: ShipCategory;
  ships: ShipModel[];
}

/**
 * Groups sorted ships into the fixed category order, skipping empty buckets
 * (spec §5.2). Input is expected pre-sorted; ordering within a bucket is kept.
 */
export function groupShips(ships: ShipModel[], catalog: CatalogData | null): ShipGroup[] {
  const order: ShipCategory[] = ['landcraft', 'watercraft', 'spacecraft', 'other'];
  const buckets = new Map<ShipCategory, ShipModel[]>();
  for (const cat of order) buckets.set(cat, []);
  for (const ship of ships) {
    buckets.get(shipCategory(ship, catalog))!.push(ship);
  }
  const groups: ShipGroup[] = [];
  for (const cat of order) {
    const list = buckets.get(cat)!;
    if (list.length > 0) groups.push({ category: cat, ships: list });
  }
  return groups;
}

/** Ordered picker groups for locations, preserving catalog file order (spec §7.2). */
export function groupLocations(
  locations: ShipLocation[],
): Array<{ group: ShipLocation['group']; entries: ShipLocation[] }> {
  const order: Array<ShipLocation['group']> = [
    'landmarks',
    'stations',
    'bodies',
    'special',
    'custom',
  ];
  return order
    .map((group) => ({ group, entries: locations.filter((l) => l.group === group) }))
    .filter((g) => g.entries.length > 0);
}
