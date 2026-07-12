/**
 * Fishing map data (spec §4). `fishing_zones.json` is 100 zone objects: a 96-cell
 * river grid (room `rankle-river`) plus four single-zone "map rooms".
 */

export interface FishingMapRef {
  mapId: string;
  zoneId?: string;
}

export interface FishingZone {
  id: number;
  name: string;
  accessible: boolean;
  /** Raw depth string (may be the literal "None"); null when absent. */
  depth: string | null;
  /** Raw pole string (display verbatim); null → 'n/a'. */
  pole: string | null;
  room: string;
  isMapRoom: boolean;
  mapRef?: FishingMapRef | null;
}

export interface FishingDepth {
  name: string;
  symbol: string;
  color: string;
}

/** The 9 depth values in legend order (§4.1). */
export const FISHING_DEPTHS: readonly FishingDepth[] = [
  { name: 'Unknown', symbol: '?', color: '#4F6A87' },
  { name: 'Pond', symbol: '■', color: '#B07A3A' },
  { name: 'Shore', symbol: '■', color: '#9B5BD9' },
  { name: 'Harbour', symbol: '■', color: '#E07AA8' },
  { name: 'Grove', symbol: '■', color: '#4FB36A' },
  { name: 'Deep', symbol: '■', color: '#3F88E8' },
  { name: 'Void', symbol: '■', color: '#E25470' },
  { name: 'Wreck', symbol: '■', color: '#CFD8E3' },
  { name: 'Lair', symbol: '■', color: '#4A2D6E' },
];

const DEPTH_BY_NAME = new Map(FISHING_DEPTHS.map((d) => [d.name, d]));

/**
 * Resolves a raw depth string to a FishingDepth by exact label. `null`,
 * `"None"`, or any unrecognised value → null (no depth).
 */
export function depthFromName(name: string | null): FishingDepth | null {
  if (name === null) return null;
  return DEPTH_BY_NAME.get(name) ?? null;
}

export interface FishingRoom {
  /** Slug, e.g. `rankle-river` - used in the route. */
  id: string;
  name: string;
  zones: FishingZone[];
  isSolo: boolean;
}

const ROOM_ORDER = ['west-shire', 'east-shire', 'imperious-falls', 'event-arena', 'rankle-river'];

const ROOM_NAMES: Record<string, string> = {
  'rankle-river': 'Rankle River',
  'west-shire': 'West Shire',
  'east-shire': 'East Shire',
  'imperious-falls': 'Imperious Falls',
  'event-arena': 'Event Arena',
};

/** Title-cases a slug on `-` for unmapped rooms. */
function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(' ');
}

export function roomDisplayName(slug: string): string {
  return ROOM_NAMES[slug] ?? titleCaseSlug(slug);
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Parses the raw JSON array; skips malformed rows. */
export function parseFishingZones(raw: unknown): FishingZone[] {
  if (!Array.isArray(raw)) return [];
  const zones: FishingZone[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'number' || typeof obj.room !== 'string') continue;
    zones.push({
      id: obj.id,
      name: typeof obj.name === 'string' ? obj.name : 'Unknown',
      accessible: obj.accessible === true,
      depth: toNullableString(obj.depth),
      pole: toNullableString(obj.pole),
      room: obj.room,
      isMapRoom: obj.isMapRoom === true,
      mapRef: parseMapRef(obj.mapRef),
    });
  }
  return zones;
}

function parseMapRef(value: unknown): FishingMapRef | null {
  if (value === null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.mapId !== 'string') return null;
  return { mapId: obj.mapId, ...(typeof obj.zoneId === 'string' ? { zoneId: obj.zoneId } : {}) };
}

/**
 * Groups zones into rooms (§4.1): fixed order first, unexpected slugs appended
 * alphabetically; zones inside a room sorted by id ascending.
 */
export function buildRooms(zones: FishingZone[]): FishingRoom[] {
  const bySlug = new Map<string, FishingZone[]>();
  for (const zone of zones) {
    const list = bySlug.get(zone.room);
    if (list === undefined) bySlug.set(zone.room, [zone]);
    else list.push(zone);
  }

  const slugs = [...bySlug.keys()];
  const extras = slugs.filter((s) => !ROOM_ORDER.includes(s)).sort();
  const ordered = [...ROOM_ORDER.filter((s) => bySlug.has(s)), ...extras];

  return ordered.map((slug) => {
    const roomZones = [...bySlug.get(slug)!].sort((a, b) => a.id - b.id);
    return {
      id: slug,
      name: roomDisplayName(slug),
      zones: roomZones,
      isSolo: roomZones.length === 1,
    };
  });
}

export type FishingSegment = 'all' | 'known' | 'unknown';

/** Segmented filter semantics (§4.3). */
export function passesSegment(zone: FishingZone, segment: FishingSegment): boolean {
  switch (segment) {
    case 'all':
      return true;
    case 'known':
      return zone.accessible && zone.name !== 'Unknown';
    case 'unknown':
      return zone.name === 'Unknown' && zone.accessible;
  }
}

/**
 * Applies the segment + depth-chip filter. A non-empty depth selection keeps
 * only zones whose depth resolves to a selected FishingDepth; zones with
 * null/None depth never match a depth selection.
 */
export function filterZones(
  zones: FishingZone[],
  segment: FishingSegment,
  selectedDepths: ReadonlySet<string>,
): FishingZone[] {
  return zones.filter((zone) => {
    if (!passesSegment(zone, segment)) return false;
    if (selectedDepths.size > 0) {
      const depth = depthFromName(zone.depth);
      if (depth === null || !selectedDepths.has(depth.name)) return false;
    }
    return true;
  });
}
