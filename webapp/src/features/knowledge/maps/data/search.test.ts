import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapDescriptor } from '../model/types';
import { validateDocument, validateManifest } from './parse';
import { buildSearchIndex, parseZoneNumber, searchZones, type MapSearchIndex } from './search';

function readSeed(path: string): { json: unknown; bytes: number } {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/${path}`);
  return { json: JSON.parse(buf.toString('utf-8')), bytes: buf.byteLength };
}

/** The in-map index of one bundled seed map, as MapDetailView builds it. */
function mapIndex(id: string): MapSearchIndex {
  const manifest = readSeed('manifest.json');
  const parsed = validateManifest(manifest.json, manifest.bytes);
  if (!parsed.ok) throw new Error(parsed.message);
  const descriptor = parsed.value.maps.find((m) => m.id === id) as MapDescriptor;
  const file = readSeed(`${id}.map.json`);
  const doc = validateDocument(file.json, file.bytes);
  if (!doc.ok) throw new Error(doc.message);
  return buildSearchIndex([{ descriptor, doc: doc.value }]);
}

const ids = (index: MapSearchIndex, query: string): string[] =>
  searchZones(index, query).map((hit) => hit.zoneId);

describe('parseZoneNumber', () => {
  it('reads the number a query names', () => {
    for (const q of ['35', '035', ' 35 ', 'z35', 'Z35', '#35', 'zone 35', 'Zone 035', 'zone35']) {
      expect(parseZoneNumber(q), q).toBe(35);
    }
  });

  it('anything else is not a number query', () => {
    for (const q of ['', '#', 'z', 'zone', '35a', '3 5', 'kings 35', '123456']) {
      expect(parseZoneNumber(q), q).toBeNull();
    }
  });
});

describe('searchZones by zone number', () => {
  const mars = mapIndex('mars'); // generic names padded: "Zone 055"
  const io = mapIndex('io'); // every zone named: "Kings Fort" is zone 55
  const venus = mapIndex('venus'); // "Zone 55"

  it('finds the zone painted with that number, first, in every spelling', () => {
    for (const q of ['55', '055', 'z55', '#55', 'zone 55', 'Zone 55']) {
      expect(ids(mars, q)[0], `mars ${q}`).toBe('z55');
      expect(ids(io, q)[0], `io ${q}`).toBe('z55');
      expect(ids(venus, q)[0], `venus ${q}`).toBe('z55');
    }
  });

  it('then the numbers it prefixes, in number order', () => {
    // Before: "55" listed Zone 550…559 but not zone 55 itself.
    expect(ids(mars, '55')).toEqual(['z55', ...Array.from({ length: 10 }, (_, i) => `z${550 + i}`)]);
    const io5 = ids(io, '5');
    expect(io5[0]).toBe('z5');
    expect(io5).toEqual(expect.arrayContaining(['z50', 'z59']));
  });

  it('still finds zones by name and fields', () => {
    expect(ids(io, 'kings fort')).toEqual(['z55']);
    expect(searchZones(mars, 'Lalothen')).toHaveLength(40);
    expect(ids(io, 'qwxzv')).toEqual([]);
  });
});
