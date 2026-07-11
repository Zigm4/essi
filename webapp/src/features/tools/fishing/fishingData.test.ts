// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRooms,
  depthFromName,
  filterZones,
  parseFishingZones,
  passesSegment,
  roomDisplayName,
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

  it('applies the segment semantics', () => {
    expect(sample.filter((z) => passesSegment(z, 'known')).map((z) => z.id)).toEqual([1, 4]);
    expect(sample.filter((z) => passesSegment(z, 'unknown')).map((z) => z.id)).toEqual([2]);
    expect(sample.filter((z) => passesSegment(z, 'all')).map((z) => z.id)).toEqual([1, 2, 3, 4]);
  });

  it('depth selection excludes null/None depths', () => {
    const result = filterZones(sample, 'all', new Set(['Pond', 'Unknown']));
    expect(result.map((z) => z.id)).toEqual([1, 2]);
  });
});
