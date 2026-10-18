// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseJobsJson, type Job } from './jobModel';
import { astroLabel, buildPlaces, parsePlaceKey, placeContains, placeLabel } from './jobPlaces';

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
  it('always carry the number', () => {
    expect(astroLabel(301)).toBe('Luna · 301');
    expect(astroLabel(100)).toBe('Mercury · 100');
    expect(astroLabel(506)).toBe('Astro 506');
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
    expect(places.astros.find((a) => a.astnum === 506)!.label).toBe('Astro 506');
    for (const astro of places.astros) {
      expect(astro.zones.reduce((sum, z) => sum + z.total, 0)).toBe(astro.total);
    }
  });

  it('names a zone by its most frequent name', () => {
    expect(zoneOf(506, 55).name).toBe('Docking Port'); // Docking Port ×5, Docking Bay ×1
    expect(zoneOf(506, 55).total).toBe(6);
    expect(zoneOf(506, 53).name).toBe('Research Ring'); // vs "research ring" ×1
    expect(zoneOf(355, 54).name).toBe('Imperious Falls (ratropia)'); // null names ignored
  });

  it('breaks ties alphabetically and falls back to "Zone n"', () => {
    expect(zoneOf(301, 0).name).toBe('Luna Space'); // vs "Lunar space", 1 each
    expect(zoneOf(301, 55).name).toBe('Zone 55'); // never named
    const tie = buildPlaces([pickupJob(9, 1, 'Beta'), pickupJob(9, 1, 'Alpha')]);
    expect(tie.astros[0]!.zones[0]!.name).toBe('Alpha');
  });

  it('disambiguates zones of one astro that share a name', () => {
    expect(zoneOf(355, 35).name).toBe('Northshire · z35');
    expect(zoneOf(355, 56).name).toBe('Northshire · z56');
    expect(zoneOf(355, 55).name).toBe('Area 55 North');
  });

  it('labels place keys for chips', () => {
    expect(placeLabel(places, 'ast:301')).toBe('Luna · 301');
    expect(placeLabel(places, 'zone:506:55')).toBe('Docking Port, Astro 506');
    expect(placeLabel(places, 'zone:1:2')).toBe('Zone 2, Astro 1');
    expect(placeLabel(null, 'ast:400')).toBe('Mars · 400');
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
