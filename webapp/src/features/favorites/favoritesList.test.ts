import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FavoriteRow } from '../../data/db';
import { validateDocument, validateManifest } from '../knowledge/maps/data/parse';
import type { MapDescriptor, MapDocument } from '../knowledge/maps/model/types';
import { buildRooms, parseFishingZones } from '../tools/fishing/fishingData';
import { parseJobsJson } from '../tools/jobs/jobModel';
import type { TrackedObject } from '../tools/nasa/catalog';
import {
  buildMapLabels,
  fishingSpots,
  groupFavorites,
  jobsById,
  kindsIn,
  resolveFavorite,
  splitZoneKey,
  zoneMapIds,
  type FavoriteSources,
} from './favoritesList';

const publicDir = resolve(import.meta.dirname, '../../../public');

function readJson(path: string): { json: unknown; bytes: number } {
  const buf = readFileSync(resolve(publicDir, path));
  return { json: JSON.parse(buf.toString('utf-8')), bytes: buf.byteLength };
}

/** The bundled seed maps, parsed as the maps area parses them. */
const seedMaps: { descriptor: MapDescriptor; doc: MapDocument }[] = (() => {
  const manifest = readJson('maps-seed/manifest.json');
  const parsed = validateManifest(manifest.json, manifest.bytes);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value.maps.map((descriptor) => {
    const file = readJson(`maps-seed/${descriptor.id}.map.json`);
    const doc = validateDocument(file.json, file.bytes);
    if (!doc.ok) throw new Error(doc.message);
    return { descriptor, doc: doc.value };
  });
})();

const tracked: TrackedObject[] = [
  { name: 'Ceres', identifier: '1', kind: 'asteroid' },
  { name: 'C/2020 F3 (NEOWISE)', identifier: 'C/2020 F3 (NEOWISE)', kind: 'comet' },
];

/** Every source loaded from the real data; only Mars's document was read. */
const ready: FavoriteSources = {
  jobs: { status: 'ready', data: jobsById(parseJobsJson(readJson('catalog/jobs.json').json)) },
  articles: {
    status: 'ready',
    data: new Map([['apm-guide', { title: 'APM guide', categoryTitle: 'Maps' }]]),
  },
  maps: {
    status: 'ready',
    data: buildMapLabels(
      seedMaps.map((m) => m.descriptor),
      seedMaps.filter((m) => m.doc.id === 'mars').map((m) => ({ mapTitle: m.descriptor.title, doc: m.doc })),
    ),
  },
  fishing: {
    status: 'ready',
    data: fishingSpots(buildRooms(parseFishingZones(readJson('catalog/fishing_zones.json').json))),
  },
  tracked: { status: 'ready', data: tracked },
};

const failed: FavoriteSources = {
  jobs: { status: 'failed' },
  articles: { status: 'failed' },
  maps: { status: 'failed' },
  fishing: { status: 'failed' },
  tracked: { status: 'failed' },
};

function row(entityType: string, entityId: string, createdAt = 0): FavoriteRow {
  return { entityType, entityId, createdAt };
}

describe('job favorites', () => {
  it('names a job by type, ID and faction, and opens its sheet', () => {
    expect(resolveFavorite('job', '35511202', ready)).toEqual({
      kind: 'job',
      id: '35511202',
      title: 'Beginner #35511202',
      subtitle: 'Professor Q (PRQ)',
      known: true,
      target: { location: '/tools/jobs?job=35511202' },
    });
  });

  it('shows a job no longer in the data by its ID, not openable', () => {
    const item = resolveFavorite('job', '999', ready);
    expect(item).toMatchObject({ title: '#999', known: false, target: null });
    expect(item.subtitle).toBe('No longer in the job list');
    expect(resolveFavorite('job', 'abc', ready)).toMatchObject({ title: 'abc', known: false, target: null });
  });

  it('still opens the job when the list failed to load', () => {
    expect(resolveFavorite('job', '35511202', failed)).toMatchObject({
      title: '#35511202',
      known: true,
      target: { location: '/tools/jobs?job=35511202' },
    });
  });
});

describe('article favorites', () => {
  it('names an article by title and category, and links its (encoded) slug', () => {
    expect(resolveFavorite('kb_article', 'apm-guide', ready)).toMatchObject({
      title: 'APM guide',
      subtitle: 'Maps',
      target: { location: '/knowledge/article/apm-guide' },
    });
    expect(resolveFavorite('kb_article', 'a b', failed).target).toEqual({ location: '/knowledge/article/a%20b' });
  });

  it('shows a removed article by its slug', () => {
    expect(resolveFavorite('kb_article', 'gone', ready)).toMatchObject({ title: 'gone', known: false, target: null });
  });
});

describe('map and zone favorites', () => {
  it('names an installed map and opens it', () => {
    expect(resolveFavorite('map', 'io', ready)).toMatchObject({
      title: 'Io',
      subtitle: 'Volcanic moon — 170 zones · 17×10 grid',
      known: true,
      target: { location: '/knowledge/maps/io' },
    });
  });

  it('shows a map that is not installed by its id', () => {
    expect(resolveFavorite('map', 'europa', ready)).toMatchObject({
      title: 'europa',
      subtitle: 'Map not installed',
      known: false,
      target: null,
    });
  });

  it('splits `mapId/zoneId` on the first slash', () => {
    expect(splitZoneKey('mars/z101')).toEqual({ mapId: 'mars', zoneId: 'z101' });
    expect(splitZoneKey('io/a/b')).toEqual({ mapId: 'io', zoneId: 'a/b' });
    expect(splitZoneKey('mars')).toBeNull();
    expect(splitZoneKey('/z1')).toBeNull();
    expect(splitZoneKey('mars/')).toBeNull();
  });

  it('names a zone with its map and searchable fields (as global search does), and opens it on the map', () => {
    expect(resolveFavorite('map_zone', 'mars/z101', ready)).toMatchObject({
      title: 'Zone 101',
      subtitle: 'Mars · Zigm4 · Medical Facility',
      known: true,
      target: { location: '/knowledge/maps/mars?zone=z101' },
    });
  });

  it('opens a zone of a map whose document was not read, by its zone id', () => {
    expect(resolveFavorite('map_zone', 'io/z1', ready)).toMatchObject({
      title: 'z1',
      subtitle: 'Io',
      known: true,
      target: { location: '/knowledge/maps/io?zone=z1' },
    });
  });

  it('shows gone zones (map not installed, zone dropped, malformed id) by their raw id', () => {
    expect(resolveFavorite('map_zone', 'europa/z1', ready)).toMatchObject({
      title: 'europa/z1',
      subtitle: 'Map not installed',
      known: false,
      target: null,
    });
    expect(resolveFavorite('map_zone', 'mars/z9999', ready)).toMatchObject({
      title: 'mars/z9999',
      subtitle: 'No longer on Mars',
      known: false,
    });
    expect(resolveFavorite('map_zone', 'mars', ready)).toMatchObject({ known: false, target: null });
  });

  it('encodes the zone link and keeps it when the maps failed to load', () => {
    expect(resolveFavorite('map_zone', 'io/a b', failed)).toMatchObject({
      title: 'io/a b',
      target: { location: '/knowledge/maps/io?zone=a%20b' },
    });
  });

  it('lists the maps the zone favorites need, once each', () => {
    const rows = [row('map_zone', 'mars/Z1'), row('map_zone', 'io/z2'), row('map_zone', 'mars/Z3'), row('map', 'venus')];
    expect(zoneMapIds(rows)).toEqual(['io', 'mars']);
  });
});

describe('fishing zone favorites', () => {
  it('opens a river zone with its sheet', () => {
    expect(resolveFavorite('fishing_zone', '23', ready)).toMatchObject({
      title: 'Zone 23 · Barbary Bend',
      subtitle: 'Rankle River · Depth: Grove',
      target: { location: '/tools/fishing/rankle-river?zone=23' },
    });
    expect(resolveFavorite('fishing_zone', '16', ready)).toMatchObject({
      title: 'Zone 16 · Reef',
      subtitle: 'Rankle River · Not accessible',
    });
    expect(resolveFavorite('fishing_zone', '1', ready).title).toBe('Zone 1');
  });

  it('opens a one-zone map room as the room', () => {
    expect(resolveFavorite('fishing_zone', '998', ready)).toMatchObject({
      title: 'East Shire',
      target: { location: '/tools/fishing/east-shire' },
    });
  });

  it('falls back to the Fishing tool without the data, and to the raw id for a gone zone', () => {
    expect(resolveFavorite('fishing_zone', '23', failed)).toMatchObject({
      title: 'Zone 23',
      target: { location: '/tools/fishing' },
    });
    expect(resolveFavorite('fishing_zone', '500', ready)).toMatchObject({ title: '500', known: false, target: null });
  });
});

describe('tracked object favorites', () => {
  it('tracks a planet or moon by its jpl: id', () => {
    expect(resolveFavorite('tracked_object', 'jpl:502', ready)).toEqual({
      kind: 'tracked_object',
      id: 'jpl:502',
      title: 'Europa',
      subtitle: 'Moon of Jupiter',
      known: true,
      target: { location: '/tools/tracker', state: { name: 'Europa', kind: 'moon', mpcID: 'jpl:502' } },
    });
    expect(resolveFavorite('tracked_object', 'jpl:499', failed)).toMatchObject({
      title: 'Mars',
      target: { state: { name: 'Mars', kind: 'planet', mpcID: 'jpl:499' } },
    });
  });

  it('shows an unknown jpl: id as gone', () => {
    expect(resolveFavorite('tracked_object', 'jpl:123456', ready)).toMatchObject({ known: false, target: null });
  });

  it('names catalog objects and tracks any designation', () => {
    expect(resolveFavorite('tracked_object', '1', ready)).toMatchObject({
      title: 'Ceres',
      subtitle: 'Asteroid · 1',
      target: { location: '/tools/tracker', state: { name: 'Ceres', kind: 'asteroid', mpcID: '1' } },
    });
    expect(resolveFavorite('tracked_object', '2024 YR4', ready)).toMatchObject({
      title: '2024 YR4',
      subtitle: 'Asteroid',
      known: true,
      target: { state: { name: '2024 YR4', kind: 'asteroid', mpcID: '2024 YR4' } },
    });
    expect(resolveFavorite('tracked_object', '1P', ready)).toMatchObject({ subtitle: 'Comet' });
  });
});

describe('groupFavorites', () => {
  it('groups by kind in page order, sorts by title (numbers in order) and drops unknown kinds', () => {
    const rows = [
      row('tracked_object', 'jpl:502'),
      row('job', '35511210'),
      row('mystery', 'x'),
      row('job', '35511202'),
      row('kb_article', 'apm-guide'),
      row('fishing_zone', '23'),
      row('map_zone', 'mars/z101'),
      row('map', 'mars'),
      row('fishing_zone', '9'),
    ];
    const groups = groupFavorites(rows, ready);
    expect(groups.map((g) => g.title)).toEqual([
      'Jobs',
      'Articles',
      'Maps',
      'Map zones',
      'Fishing zones',
      'Tracked objects',
    ]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['35511202', '35511210']);
    expect(groups[4]!.items.map((i) => i.title)).toEqual(['Zone 9', 'Zone 23 · Barbary Bend']);
    expect(groups.every((g) => g.status === 'ready')).toBe(true);
  });

  it("reports each group's source state, so one failing source doesn't hide the others", () => {
    const sources: FavoriteSources = { ...ready, jobs: { status: 'failed' }, maps: { status: 'loading' } };
    const groups = groupFavorites([row('job', '1'), row('map', 'mars'), row('map_zone', 'mars/Z1'), row('kb_article', 'apm-guide')], sources);
    expect(groups.map((g) => [g.kind, g.status])).toEqual([
      ['job', 'failed'],
      ['kb_article', 'ready'],
      ['map', 'loading'],
      ['map_zone', 'loading'],
    ]);
  });

  it('has no groups without favorites, and knows which kinds are starred', () => {
    expect(groupFavorites([], ready)).toEqual([]);
    expect([...kindsIn([row('job', '1'), row('mystery', 'x'), row('job', '2')])]).toEqual(['job']);
  });
});
