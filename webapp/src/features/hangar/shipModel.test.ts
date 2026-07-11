import { describe, expect, it } from 'vitest';
import { availableRoles, type CatalogData, type ShipCatalogEntry, type ShipLocation } from './catalog';
import { emptyRoles, type ShipModel } from './shipModel';
import {
  composedName,
  extractSuffix,
  groupShips,
  hullTone,
  locationDisplay,
  modelLabel,
  shipCategory,
  sortShips,
} from './shipModel';

const MODELS: ShipCatalogEntry[] = [
  { key: 'mmc-shootingstar', displayName: 'MMC Shootingstar', category: 'spacecraft', prefix: 'MMCS', crewSize: null, hullMax: null },
  { key: 'solstice-trigrave', displayName: 'Solstice Trigrave', category: 'spacecraft', prefix: 'SOLT', crewSize: 2, hullMax: 80 },
  { key: 'evil-lawless', displayName: 'EVIL Lawless', category: 'spacecraft', prefix: 'EVIL', crewSize: 0, hullMax: null },
  { key: 'rat-raft', displayName: 'Rat Raft', category: 'watercraft', prefix: 'RATR', crewSize: null, hullMax: null },
  { key: 'moon-buggy', displayName: 'Moon Buggy', category: 'landcraft', prefix: 'MOOB', crewSize: 1, hullMax: null },
];

const LOCATIONS: ShipLocation[] = [
  { key: 'mars', displayName: 'Mars', group: 'bodies', subtitle: null, paramKind: 'zone', defaultZone: 55, isSpacecraftDefault: false },
  { key: 'space', displayName: 'Space', group: 'special', subtitle: 'Sector + distance in SL', paramKind: 'spaceCoordinate', defaultZone: null, isSpacecraftDefault: false },
  { key: 'area-55', displayName: 'Area 55', group: 'landmarks', subtitle: null, paramKind: null, defaultZone: null, isSpacecraftDefault: false },
  { key: 'other', displayName: 'Other (custom)', group: 'custom', subtitle: null, paramKind: null, defaultZone: null, isSpacecraftDefault: false },
];

const CATALOG: CatalogData = {
  models: MODELS,
  locations: LOCATIONS,
  modelByKey: new Map(MODELS.map((m) => [m.key, m])),
  locationByKey: new Map(LOCATIONS.map((l) => [l.key, l])),
};

function makeShip(partial: Partial<ShipModel>): ShipModel {
  return {
    id: partial.id ?? 'id',
    name: partial.name ?? '',
    modelKey: partial.modelKey ?? null,
    customModelLabel: partial.customModelLabel ?? null,
    registered: partial.registered ?? false,
    locationKey: partial.locationKey ?? null,
    customLocation: partial.customLocation ?? null,
    locationZone: partial.locationZone ?? null,
    locationSector: partial.locationSector ?? null,
    locationSL: partial.locationSL ?? null,
    hull: partial.hull ?? null,
    roles: partial.roles ?? emptyRoles(),
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    tags: partial.tags ?? [],
  };
}

describe('extractSuffix', () => {
  it('returns empty for an empty prefix', () => {
    expect(extractSuffix('anything', '')).toBe('');
  });
  it('splits PREFIX-SUFFIX', () => {
    expect(extractSuffix('MMCS-1234', 'MMCS')).toBe('1234');
  });
  it('tolerates a missing dash', () => {
    expect(extractSuffix('MMCS1234', 'MMCS')).toBe('1234');
  });
  it('returns the raw name on prefix mismatch', () => {
    expect(extractSuffix('1234', 'MMCS')).toBe('1234');
  });
});

describe('composedName', () => {
  const byKey = CATALOG.modelByKey;
  it('joins prefix + trimmed suffix', () => {
    expect(composedName({ modelKey: 'mmc-shootingstar', suffixField: ' 42 ', nameField: '' }, byKey)).toBe('MMCS-42');
  });
  it('is blank when a prefixed model has an empty suffix', () => {
    expect(composedName({ modelKey: 'mmc-shootingstar', suffixField: '   ', nameField: 'x' }, byKey)).toBe('');
  });
  it('uses the trimmed name field with no model', () => {
    expect(composedName({ modelKey: null, suffixField: '', nameField: '  Wanderer ' }, byKey)).toBe('Wanderer');
  });
});

describe('locationDisplay', () => {
  it('hides the row with no location', () => {
    expect(locationDisplay(makeShip({}), CATALOG)).toBeNull();
  });
  it('formats a zone location using the stored zone', () => {
    expect(locationDisplay(makeShip({ locationKey: 'mars', locationZone: 12 }), CATALOG)).toBe('Mars · zone 12');
  });
  it('falls back to the default zone', () => {
    expect(locationDisplay(makeShip({ locationKey: 'mars' }), CATALOG)).toBe('Mars · zone 55');
  });
  it('formats a space coordinate', () => {
    expect(locationDisplay(makeShip({ locationKey: 'space', locationSector: 'A-1', locationSL: 12 }), CATALOG)).toBe('Space · A-1, 12 SL');
  });
  it('shows ? SL when the sector is blank', () => {
    expect(locationDisplay(makeShip({ locationKey: 'space' }), CATALOG)).toBe('Space · ? SL');
  });
  it('shows a plain name for param-less locations', () => {
    expect(locationDisplay(makeShip({ locationKey: 'area-55' }), CATALOG)).toBe('Area 55');
  });
  it('uses trimmed custom location text for "other"', () => {
    expect(locationDisplay(makeShip({ locationKey: 'other', customLocation: '  Home  ' }), CATALOG)).toBe('Home');
    expect(locationDisplay(makeShip({ locationKey: 'other', customLocation: '   ' }), CATALOG)).toBeNull();
  });
});

describe('hullTone', () => {
  it('is success at or above 0.75', () => {
    expect(hullTone(60, 80)).toBe('success');
  });
  it('is warn between 0.40 and 0.75', () => {
    expect(hullTone(40, 80)).toBe('warn');
  });
  it('is danger below 0.40', () => {
    expect(hullTone(10, 80)).toBe('danger');
  });
  it('treats a zero max as ratio zero (danger)', () => {
    expect(hullTone(5, 0)).toBe('danger');
  });
});

describe('availableRoles', () => {
  it('gives all 12 seats when crewSize is null', () => {
    expect(availableRoles(CATALOG.modelByKey.get('mmc-shootingstar')).length).toBe(12);
  });
  it('gives the first N seats', () => {
    expect(availableRoles(CATALOG.modelByKey.get('solstice-trigrave'))).toEqual(['pilot', 'gunner']);
  });
  it('gives none for crewSize 0 (EVIL)', () => {
    expect(availableRoles(CATALOG.modelByKey.get('evil-lawless'))).toEqual([]);
  });
});

describe('shipCategory + grouping', () => {
  it('buckets by catalog category, unknown → other', () => {
    expect(shipCategory(makeShip({ modelKey: 'rat-raft' }), CATALOG)).toBe('watercraft');
    expect(shipCategory(makeShip({ modelKey: 'nope' }), CATALOG)).toBe('other');
    expect(shipCategory(makeShip({ modelKey: null }), CATALOG)).toBe('other');
  });
  it('groups in fixed order, skipping empties', () => {
    const ships = [
      makeShip({ id: '1', name: 'b', modelKey: 'rat-raft' }),
      makeShip({ id: '2', name: 'a', modelKey: 'moon-buggy' }),
      makeShip({ id: '3', name: 'c', modelKey: 'mmc-shootingstar' }),
    ];
    const groups = groupShips(sortShips(ships), CATALOG);
    expect(groups.map((g) => g.category)).toEqual(['landcraft', 'watercraft', 'spacecraft']);
  });
});

describe('sortShips', () => {
  it('sorts by name, case-insensitive', () => {
    const ships = [makeShip({ name: 'banana' }), makeShip({ name: 'Apple' }), makeShip({ name: 'cherry' })];
    expect(sortShips(ships).map((s) => s.name)).toEqual(['Apple', 'banana', 'cherry']);
  });
});

describe('modelLabel', () => {
  it('prefers a non-empty custom label', () => {
    expect(modelLabel(makeShip({ modelKey: 'rat-raft', customModelLabel: 'My Raft' }), CATALOG)).toBe('My Raft');
  });
  it('falls back to the catalog display name', () => {
    expect(modelLabel(makeShip({ modelKey: 'rat-raft' }), CATALOG)).toBe('Rat Raft');
  });
  it('is null with no model and no custom label', () => {
    expect(modelLabel(makeShip({}), CATALOG)).toBeNull();
  });
});
