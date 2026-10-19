// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FISHING_DEPTHS,
  buildRooms,
  depthCounts,
  depthFromName,
  filterZones,
  hasKnownDepth,
  isFiltering,
  matchesFilter,
  parseFishingZones,
  passesSegment,
  roomDisplayName,
  type FishingSegment,
  type FishingZone,
} from './fishingData';

const zones = parseFishingZones(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../public/catalog/fishing_zones.json', import.meta.url)),
      'utf-8',
    ),
  ),
);

describe('parseFishingZones', () => {
  it('loads all 100 zones', () => {
    expect(zones.length).toBe(100);
  });
});

describe('depthFromName', () => {
  it('matches known labels including Unknown', () => {
    expect(depthFromName('Pond')?.color).toBe('#B07A3A');
    expect(depthFromName('Unknown')?.symbol).toBe('?');
  });

  it('treats null, "None", and junk as no depth', () => {
    expect(depthFromName(null)).toBeNull();
    expect(depthFromName('None')).toBeNull();
    expect(depthFromName('Swamp')).toBeNull();
  });
});

describe('buildRooms', () => {
  it('orders rooms with rankle-river last and 96 zones sorted by id', () => {
    const rooms = buildRooms(zones);
    expect(rooms.map((r) => r.id)).toEqual([
      'west-shire',
      'east-shire',
      'imperious-falls',
      'event-arena',
      'rankle-river',
    ]);
    const river = rooms.find((r) => r.id === 'rankle-river');
    expect(river?.zones.length).toBe(96);
    expect(river?.isSolo).toBe(false);
    const ids = river!.zones.map((z) => z.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    const westShire = rooms.find((r) => r.id === 'west-shire');
    expect(westShire?.isSolo).toBe(true);
    expect(westShire?.name).toBe('West Shire');
  });

  it('appends unexpected slugs alphabetically after the known order', () => {
    const custom: FishingZone[] = [
      { id: 1, name: 'A', accessible: true, depth: null, pole: null, room: 'zeta', isMapRoom: false },
      { id: 2, name: 'B', accessible: true, depth: null, pole: null, room: 'alpha', isMapRoom: false },
      { id: 3, name: 'C', accessible: true, depth: null, pole: null, room: 'rankle-river', isMapRoom: false },
    ];
    expect(buildRooms(custom).map((r) => r.id)).toEqual(['rankle-river', 'alpha', 'zeta']);
  });
});

describe('roomDisplayName', () => {
  it('maps known slugs and title-cases the rest', () => {
    expect(roomDisplayName('imperious-falls')).toBe('Imperious Falls');
    expect(roomDisplayName('deep-blue-sea')).toBe('Deep Blue Sea');
  });
});

describe('segment + depth filters', () => {
  const sample: FishingZone[] = [
    { id: 1, name: 'Named', accessible: true, depth: 'Pond', pole: 'Red', room: 'rankle-river', isMapRoom: false },
    { id: 2, name: 'Unknown', accessible: true, depth: 'Unknown', pole: 'Unknown', room: 'rankle-river', isMapRoom: false },
    { id: 3, name: 'Reef', accessible: false, depth: null, pole: null, room: 'rankle-river', isMapRoom: false },
    { id: 4, name: 'NoneDepth', accessible: true, depth: 'None', pole: 'Blue', room: 'rankle-river', isMapRoom: false },
  ];

  const ids = (segment: FishingSegment) => sample.filter((z) => passesSegment(z, segment)).map((z) => z.id);

  it('segments by what is known about the depth, not the name', () => {
    expect(ids('all')).toEqual([1, 2, 3, 4]);
    expect(ids('depthKnown')).toEqual([1]);
    expect(ids('toDiscover')).toEqual([2, 4]); // "Unknown" and "None" depths alike
    expect(ids('reefs')).toEqual([3]);
  });

  it('treats only a real depth as known', () => {
    expect(sample.map(hasKnownDepth)).toEqual([true, false, false, false]);
  });

  it('depth selection excludes null/None depths', () => {
    const result = filterZones(sample, 'all', new Set(['Pond', 'Unknown']));
    expect(result.map((z) => z.id)).toEqual([1, 2]);
    expect(matchesFilter(sample[3]!, 'toDiscover', new Set(['Unknown']))).toBe(false);
  });

  it('only filters when a segment or a chip narrows things', () => {
    expect(isFiltering('all', new Set())).toBe(false);
    expect(isFiltering('reefs', new Set())).toBe(true);
    expect(isFiltering('all', new Set(['Pond']))).toBe(true);
  });
});

describe('Rankle River filters', () => {
  const river = buildRooms(zones).find((r) => r.id === 'rankle-river')!.zones;
  const count = (segment: FishingSegment) => filterZones(river, segment, new Set()).length;

  it('splits the 96 cells into depth known / to discover / reefs', () => {
    expect([count('depthKnown'), count('toDiscover'), count('reefs')]).toEqual([23, 59, 14]);
    expect(count('depthKnown') + count('toDiscover') + count('reefs')).toBe(count('all'));
    expect(count('all')).toBe(96);
  });

  it('keeps every grid position: the filter flags cells, it does not drop them', () => {
    const flags = river.map((z) => matchesFilter(z, 'all', new Set(['Harbour'])));
    expect(flags).toHaveLength(96);
    expect(flags.filter(Boolean)).toHaveLength(7);
  });

  it('counts the zones behind each chip within a segment, so dead chips can be disabled', () => {
    const all = depthCounts(river, 'all');
    expect([...all.keys()]).toEqual(FISHING_DEPTHS.map((d) => d.name));
    expect(all.get('Harbour')).toBe(7);
    expect(all.get('Unknown')).toBe(59);
    expect(all.get('Pond')).toBe(0); // only West Shire is Pond

    const toDiscover = depthCounts(river, 'toDiscover');
    expect([...toDiscover].filter(([, n]) => n > 0)).toEqual([['Unknown', 59]]);
    expect(depthCounts(river, 'depthKnown').get('Unknown')).toBe(0);
    expect([...depthCounts(river, 'reefs').values()].every((n) => n === 0)).toBe(true);
  });

  it('has no always-empty combination among enabled chips', () => {
    const segments: FishingSegment[] = ['all', 'depthKnown', 'toDiscover', 'reefs'];
    for (const segment of segments) {
      for (const [name, n] of depthCounts(river, segment)) {
        expect(filterZones(river, segment, new Set([name])).length).toBe(n);
      }
    }
  });
});
