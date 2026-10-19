// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseJobsJson, type Job } from './jobModel';
import {
  astroLabel,
  buildPlaces,
  locationDisplayLabel,
  locationName,
  parsePlaceKey,
  placeContains,
  placeLabel,
  zoneLabel,
} from './jobPlaces';

const jobs = parseJobsJson(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/catalog/jobs.json', import.meta.url)), 'utf-8'),
  ),
);
const places = buildPlaces(jobs);

function zoneOf(astnum: number, zone: number) {
  const z = places.astros.find((a) => a.astnum === astnum)?.zones.find((x) => x.zone === zone);
  if (z === undefined) throw new Error(`no zone ${astnum}:${zone}`);
  return z;
}

function pickupJob(astnum: number, zone: number, name: string | null): Job {
  const loc = { astnum, zone, name };
  return { ...jobs[0]!, pickupLocation: loc, dropoffLocation: loc };
}

describe('astro labels', () => {
  it("use the owner's names and always carry the number", () => {
    expect(astroLabel(301)).toBe('Luna · 301');
    expect(astroLabel(100)).toBe('Mercury · 100');
    expect(astroLabel(506)).toBe('Jupiter Station · 506');
    expect(astroLabel(355)).toBe('Ratropia · 355');
    expect(astroLabel(174310223)).toBe('Oort Station · 174310223');
    expect(astroLabel(206)).toBe('Venus Station · 206');
    expect(astroLabel(466)).toBe('Astro 466');
  });
});

describe('buildPlaces', () => {
  it('groups every pickup by astro, busiest first', () => {
    expect(places.astros.reduce((sum, a) => sum + a.total, 0)).toBe(371);
    expect(places.astros[0]!.astnum).toBe(355);
    expect(places.astros[0]!.total).toBe(55);
    const luna = places.astros.find((a) => a.astnum === 301)!;
    expect(luna.label).toBe('Luna · 301');
    expect(luna.total).toBe(24);
    expect(places.astros.find((a) => a.astnum === 506)!.label).toBe('Jupiter Station · 506');
    expect(places.astros.find((a) => a.astnum === 466)!.label).toBe('Astro 466');
    for (const astro of places.astros) {
      expect(astro.zones.reduce((sum, z) => sum + z.total, 0)).toBe(astro.total);
    }
  });

  it("names a zone by the owner's table first, else by its most frequent name", () => {
    expect(zoneOf(506, 55).name).toBe('Docking Port'); // owner's name (data: Docking Port ×5, Docking Bay ×1)
    expect(zoneOf(506, 55).total).toBe(6);
    expect(zoneOf(206, 59).name).toBe('Life Support System'); // every station gets the nine zone names
    expect(zoneOf(355, 54).name).toBe('Imperious Falls'); // owner's name beats "Imperious Falls (ratropia)"
    expect(zoneOf(355, 68).name).toBe('Town Hall');
    expect(placeLabel(null, 'zone:355:112')).toBe("Ratropia · Queen's Quarry"); // a dropoff only; beats "Queens Quarry"
    expect(zoneOf(301, 7).name).toBe('Luna Mesa Mart / Moonhowl Mesa (Endymion)');
    expect(zoneOf(301, 73).name).toBe('Moonclaw Mountains (Lycanox)'); // not listed: most frequent pickup name
    expect(zoneOf(401, 49).name).toBe("Wendell's Watch (comms) observatory");
    expect(zoneLabel(355, 999)).toBeNull();
  });

  it('breaks ties alphabetically and falls back to "Zone n"', () => {
    expect(zoneOf(301, 0).name).toBe('Luna Space'); // vs "Lunar space", 1 each
    expect(zoneOf(301, 55).name).toBe('Zone 55'); // never named
    const tie = buildPlaces([pickupJob(9, 1, 'Beta'), pickupJob(9, 1, 'Alpha')]);
    expect(tie.astros[0]!.zones[0]!.name).toBe('Alpha');
  });

  it('names the six shire squares, which the data files all under "Northshire"', () => {
    expect(zoneOf(355, 35).name).toBe('Northshire');
    expect(zoneOf(355, 56).name).toBe('Upshire');
    expect(zoneOf(355, 67).name).toBe('Westshire');
    expect(zoneOf(355, 70).name).toBe('Eastshire');
    expect(zoneOf(355, 78).name).toBe('Downshire');
    expect(zoneOf(355, 90).name).toBe('Southshire');
    expect(zoneOf(355, 55).name).toBe('Area55 North');
  });

  it('disambiguates zones of one astro that share a name', () => {
    const twins = buildPlaces([pickupJob(9, 1, 'Twin'), pickupJob(9, 2, 'Twin')]);
    expect(twins.astros[0]!.zones.map((z) => z.name).sort()).toEqual(['Twin · z1', 'Twin · z2']);
  });

  it('labels place keys for chips', () => {
    expect(placeLabel(places, 'ast:301')).toBe('Luna · 301');
    expect(placeLabel(places, 'zone:506:55')).toBe('Jupiter Station · Docking Port');
    expect(placeLabel(places, 'zone:206:55')).toBe('Venus Station · Docking Port');
    expect(placeLabel(places, 'zone:301:0')).toBe('Luna Space'); // already names the astro
    expect(placeLabel(places, 'zone:355:35')).toBe('Ratropia · Northshire');
    expect(placeLabel(places, 'zone:1:2')).toBe('Astro 1 · Zone 2');
    expect(placeLabel(null, 'zone:355:68')).toBe('Ratropia · Town Hall');
    expect(placeLabel(null, 'ast:400')).toBe('Mars · 400');
  });

  it("labels a job's location for cards and the detail sheet", () => {
    expect(locationDisplayLabel({ astnum: 506, zone: 55, name: 'Docking Bay' })).toBe(
      'Jupiter Station · Docking Port (506 · z55)',
    );
    expect(locationDisplayLabel({ astnum: 355, zone: 35, name: 'Northshire' })).toBe('Ratropia · Northshire (355 · z35)');
    expect(locationDisplayLabel({ astnum: 301, zone: 0, name: 'Luna Space' })).toBe('Luna Space (301 · z0)');
    expect(locationDisplayLabel({ astnum: 200, zone: 55, name: 'Venus' })).toBe('Venus (200 · z55)');
    expect(locationDisplayLabel({ astnum: 301, zone: 55, name: null })).toBe('Luna (301 · z55)');
    expect(locationDisplayLabel({ astnum: 199990000, zone: 58, name: 'OORTOPIA - Engineering Core' })).toBe(
      'OORTOPIA - Engineering Core (199990000 · z58)',
    );
    expect(locationDisplayLabel({ astnum: 9, zone: 1, name: null })).toBe('9 · z1');
    expect(locationName({ astnum: 9, zone: 1, name: null })).toBeNull();
  });
});

describe('place keys', () => {
  it('parse and match', () => {
    expect(parsePlaceKey('ast:355')).toEqual({ astnum: 355, zone: null });
    expect(parsePlaceKey('zone:355:35')).toEqual({ astnum: 355, zone: 35 });
    expect(parsePlaceKey('zone:355')).toBeNull();
    expect(parsePlaceKey('nope')).toBeNull();
    const loc = { astnum: 355, zone: 35, name: null };
    expect(placeContains({ astnum: 355, zone: null }, loc)).toBe(true);
    expect(placeContains({ astnum: 355, zone: 35 }, loc)).toBe(true);
    expect(placeContains({ astnum: 355, zone: 36 }, loc)).toBe(false);
  });
});
