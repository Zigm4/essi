import { describe, expect, it } from 'vitest';
import {
  describeMajorBody,
  findMajorBody,
  MAJOR_BODIES,
  majorBodyFromId,
  majorBodyId,
  majorBodySuggestions,
  normalizeBodyName,
  trackDesignation,
  trackSymbol,
} from './majorBodies';

describe('findMajorBody', () => {
  it('finds a moon by its name, whatever the case and spacing', () => {
    const europa = findMajorBody('  europa ');
    expect(europa).toMatchObject({ naif: 502, name: 'Europa', type: 'moon', parent: 'Jupiter' });
    expect(findMajorBody('EUROPA')?.naif).toBe(502);
  });

  it('finds planets, the Sun and Pluto', () => {
    expect(findMajorBody('Jupiter')).toMatchObject({ naif: 599, type: 'planet' });
    expect(findMajorBody('Earth')).toMatchObject({ naif: 399, type: 'planet' });
    expect(findMajorBody('Pluto')).toMatchObject({ naif: 999, type: 'dwarf planet' });
    expect(findMajorBody('Sun')).toMatchObject({ naif: 10, type: 'star' });
  });

  it('knows catalogue numbers and other names', () => {
    expect(findMajorBody('Jupiter II')?.name).toBe('Europa');
    expect(findMajorBody('Saturn VI')?.name).toBe('Titan');
    expect(findMajorBody('Neptune I')?.name).toBe('Triton');
    expect(findMajorBody('Jupiter L')?.name).toBe('Herse');
    expect(findMajorBody('Luna')?.naif).toBe(301);
    expect(findMajorBody('the Moon')?.naif).toBe(301);
    expect(findMajorBody('Lune')?.naif).toBe(301);
    expect(findMajorBody('Ganymède')?.naif).toBe(503);
    expect(findMajorBody('Phœbé')?.naif).toBe(609);
    expect(findMajorBody('Encelade')?.naif).toBe(602);
    expect(findMajorBody('Japet')?.naif).toBe(608);
    expect(findMajorBody('Néréide')?.naif).toBe(802);
    expect(findMajorBody('Soleil')?.naif).toBe(10);
    expect(findMajorBody('Pluton')?.naif).toBe(999);
    expect(findMajorBody('Saturne')?.naif).toBe(699);
    expect(findMajorBody('Europa (moon)')?.naif).toBe(502);
  });

  it('leaves small bodies alone', () => {
    for (const name of ['Ceres', 'Halley', 'Apophis', 'C/2024 G3 (ATLAS)', '502', '', 'Jupiter 2']) {
      expect(findMajorBody(name)).toBeNull();
    }
  });
});

describe('registry', () => {
  it('has the Sun, 9 planets and 168 named moons, each id once', () => {
    expect(MAJOR_BODIES.filter((b) => b.type === 'star')).toHaveLength(1);
    expect(MAJOR_BODIES.filter((b) => b.type === 'planet' || b.type === 'dwarf planet')).toHaveLength(9);
    expect(MAJOR_BODIES.filter((b) => b.type === 'moon')).toHaveLength(168);
    expect(new Set(MAJOR_BODIES.map((b) => b.naif)).size).toBe(MAJOR_BODIES.length);
  });

  it('gives every moon the planet its id belongs to', () => {
    const parents: Record<number, string> = { 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune', 9: 'Pluto' };
    for (const moon of MAJOR_BODIES.filter((b) => b.type === 'moon')) {
      expect(moon.parent).toBe(parents[Math.floor(moon.naif / 100)]);
    }
  });

  it('leaves out Daphnis (no Horizons ephemeris after 2018)', () => {
    expect(findMajorBody('Daphnis')).toBeNull();
  });

  it('has no alias pointing at two bodies', () => {
    const seen = new Map<string, number>();
    for (const body of MAJOR_BODIES) {
      for (const key of new Set([body.name, ...body.aliases].map(normalizeBodyName))) {
        expect(seen.get(key) ?? body.naif, key).toBe(body.naif);
        seen.set(key, body.naif);
      }
    }
  });
});

describe('ids and display', () => {
  it('keeps planet / moon ids apart from MPC numbers', () => {
    const europa = findMajorBody('Europa')!;
    expect(majorBodyId(europa)).toBe('jpl:502');
    expect(majorBodyFromId('jpl:502')).toBe(europa);
    expect(majorBodyFromId('502')).toBeNull(); // asteroid 502 Sigune
    expect(majorBodyFromId('jpl:12345')).toBeNull();
  });

  it('describes and labels a track', () => {
    expect(describeMajorBody(findMajorBody('Titan')!)).toBe('Moon of Saturn');
    expect(trackDesignation({ kind: 'moon', mpcID: 'jpl:502' })).toBe('Moon of Jupiter · JPL 502');
    expect(trackDesignation({ kind: 'asteroid', mpcID: '52' })).toBe('Asteroid · MPC 52');
    expect(trackDesignation({ kind: 'comet', mpcID: '1P' })).toBe('Comet · MPC 1P');
    expect(trackSymbol({ kind: 'moon', mpcID: 'jpl:502' })).toBe('☾\uFE0E');
    expect(trackSymbol({ kind: 'planet', mpcID: 'jpl:599' })).toBe('♃');
    expect(trackSymbol({ kind: 'comet', mpcID: '1P' })).toBe('☄');
  });

  it('suggests bodies starting with the typed text', () => {
    const names = majorBodySuggestions('tit').map((b) => b.name);
    expect(names).toEqual(expect.arrayContaining(['Titan', 'Titania']));
    expect(majorBodySuggestions('t')).toEqual([]);
    expect(majorBodySuggestions('Titan').map((b) => b.name)).toEqual(['Titania']);
  });
});
