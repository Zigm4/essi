import { describe, expect, it } from 'vitest';
import type { PlanetPosition, TrackerResult } from './models';
import type { DiscoveredObject } from './sbdb';
import {
  decodeSnapshot,
  discoveriesListShare,
  discoveriesRoute,
  discoveryObjectShare,
  encodeSnapshot,
  parseDiscoveriesParams,
  scanFromSnapshot,
  scanShare,
  scanSnapshotParam,
  trackerFromSnapshot,
  trackerShare,
  trackerSnapshotParam,
} from './share';

const TRACK: TrackerResult = {
  mpcID: '1P',
  displayName: '1P/Halley',
  kind: 'comet',
  xAU: -12.345678,
  yAU: 25.6789012,
  zAU: -8.9012345,
  sector: 7,
  distanceAU: 35.123456,
  slExact: 3.51234567,
  slRounded: 3.512,
  slFloor: 3.5,
  timestamp: new Date(Date.UTC(2026, 9, 19, 0, 0, 0)),
};

function snapParam(link: string): string {
  const query = link.split('?')[1] ?? '';
  return new URLSearchParams(query).get('snap') ?? '';
}

describe('snapshot encoding', () => {
  it('round-trips unicode JSON with URL-safe characters only', () => {
    const data = { name: 'Comète ☄ 2026 (ATLAS)', n: [1, 2.5, -3] };
    const encoded = encodeSnapshot(data);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSnapshot(encoded)).toEqual(data);
  });

  it('returns null on garbage', () => {
    expect(decodeSnapshot('%%%')).toBeNull();
    expect(decodeSnapshot('bm90IGpzb24')).toBeNull(); // "not json"
  });
});

describe('tracker share', () => {
  it('restores the shared track from the snapshot link', () => {
    const share = trackerShare(TRACK);
    expect(share.link).toContain('#/tools/tracker?snap=');
    const restored = trackerFromSnapshot(snapParam(share.link));
    expect(restored).not.toBeNull();
    expect(restored!.displayName).toBe('1P/Halley');
    expect(restored!.kind).toBe('comet');
    expect(restored!.sector).toBe(7);
    expect(restored!.slExact).toBeCloseTo(3.5123, 4);
    expect(restored!.slRounded).toBe(3.512);
    expect(restored!.xAU).toBeCloseTo(-12.34568, 5);
    expect(restored!.timestamp.getTime()).toBe(TRACK.timestamp.getTime());
  });

  it('rejects a malformed or out-of-range snapshot', () => {
    expect(trackerFromSnapshot(null)).toBeNull();
    expect(trackerFromSnapshot('')).toBeNull();
    expect(trackerFromSnapshot('abc')).toBeNull();
    const bad = encodeSnapshot({ v: 1, n: 'X', k: 'a', m: 'X', t: 0, s: 13 });
    expect(trackerFromSnapshot(bad)).toBeNull();
    const ok = decodeSnapshot(trackerSnapshotParam(TRACK)) as Record<string, unknown>;
    expect(trackerFromSnapshot(encodeSnapshot({ ...ok, x: 'nope' }))).toBeNull();
  });

  it('writes an ESSI transmission with a masked, preview-less link', () => {
    const share = trackerShare(TRACK);
    const text = share.discordText;
    expect(text.startsWith('### 📡 ESSI · Priority transmission\n-# Astrometry')).toBe(true);
    expect(text).toContain('the comet ☄️ **1P/Halley**');
    expect(text).toContain('- **Sector:** 7');
    expect(text).toContain('- **Distance:** 3.512 SL');
    expect(text).toContain('- **Navigation flooring:** 3.5 SL');
    // The map distance (as computed, from X and Y) and the true 3D distance √(X² + Y² + Z²).
    expect(text).toContain('- **Map distance:** 35.123 AU (in the map plane)');
    expect(text).toContain('- **Distance from the Sun:** 29.851 AU (3D)');
    expect(text).toContain(`🔗 [Open this track in ESSI](<${share.link}>)`);
    expect(text.endsWith('East Shire Space Industries (ESSI)')).toBe(true);
    expect(share.card.blocks.some((b) => b.kind === 'kv' && b.label === 'Sector')).toBe(true);
  });

  it('says what the image is', () => {
    const share = trackerShare(TRACK);
    expect(share.title).toBe('ESSI tracking report: 1P/Halley');
    expect(share.caption).toContain('📡 ESSI tracking report · ☄️ 1P/Halley\n');
    expect(share.caption).toContain('Sector 7 · 3.512 SL · navigate 3.5 SL');
  });

  it('escapes Discord markdown in a typed name', () => {
    const share = trackerShare({ ...TRACK, displayName: '*bold*_x_' });
    expect(share.discordText).toContain('**\\*bold\\*\\_x\\_**');
  });
});

const SCAN: PlanetPosition[] = [
  { name: 'Mercury', emoji: '☿', sector: 3, distanceSL: 0.39, timestamp: new Date(0) },
  {
    name: 'Jupiter',
    emoji: '♃',
    sector: 11,
    distanceSL: 5.2,
    timestamp: new Date(0),
    nextChange: { date: new Date(Date.UTC(2027, 1, 3)), toSector: 12 },
  },
];

describe('tracker share for a moon', () => {
  const EUROPA: TrackerResult = { ...TRACK, mpcID: 'jpl:502', displayName: 'Europa', kind: 'moon', sector: 5 };

  it('names the moon and its planet', () => {
    const share = trackerShare(EUROPA);
    expect(share.discordText).toContain('locked onto the moon 🌑 **Europa**, in orbit around Jupiter.');
    expect(share.discordText).toContain('- **Designation:** JPL Horizons 502 (moon of Jupiter)');
    expect(share.caption).toContain('🌑 Europa (moon of Jupiter)');
    expect(share.card.blocks[0]).toMatchObject({ kind: 'hero', emoji: '☾\uFE0E', caption: 'Moon of Jupiter · JPL 502' });
  });

  it('restores a moon from its link, and rejects an unknown body', () => {
    const restored = trackerFromSnapshot(snapParam(trackerShare(EUROPA).link));
    expect(restored).toMatchObject({ kind: 'moon', mpcID: 'jpl:502', displayName: 'Europa' });
    const fake = decodeSnapshot(trackerSnapshotParam(EUROPA)) as Record<string, unknown>;
    expect(trackerFromSnapshot(encodeSnapshot({ ...fake, m: 'jpl:4242' }))).toBeNull();
  });

  it('calls Pluto a dwarf planet', () => {
    const share = trackerShare({ ...TRACK, mpcID: 'jpl:999', displayName: 'Pluto', kind: 'planet' });
    expect(share.discordText).toContain('the dwarf planet 🪐 **Pluto**.');
  });
});

describe('scan share', () => {
  const date = new Date(Date.UTC(2026, 9, 19, 14, 30));

  it('restores the shared scan from the snapshot link', () => {
    const share = scanShare(date, 'full', SCAN);
    const restored = scanFromSnapshot(snapParam(share.link));
    expect(restored).not.toBeNull();
    expect(restored!.mode).toBe('full');
    expect(restored!.date.getTime()).toBe(date.getTime());
    expect(restored!.snapshots.map((p) => [p.name, p.sector, p.distanceSL])).toEqual([
      ['Mercury', 3, 0.39],
      ['Jupiter', 11, 5.2],
    ]);
    expect(restored!.snapshots[1]!.nextChange?.toSector).toBe(12);
    expect(restored!.snapshots[0]!.nextChange).toBeUndefined();
  });

  it('drops unknown planets and rejects an empty snapshot', () => {
    const odd = scanSnapshotParam(date, 'light', [
      { name: 'Vulcan', emoji: '?', sector: 1, distanceSL: 1, timestamp: date },
    ]);
    expect(scanFromSnapshot(odd)).toBeNull();
  });

  it('lists every planet in the Discord message', () => {
    const share = scanShare(date, 'light', SCAN);
    expect(share.discordText).toContain('-# Planetary Monitoring Division · LIGHT scan');
    expect(share.discordText).toContain('- ☿ **Mercury** · Sector **3** · 0.39 SL');
    expect(share.discordText).toContain('· next: sector 12 on');
    expect(share.discordText).toContain('fixed the position of 2 planets');
    expect(share.caption).toContain('🪐 ESSI solar system survey · LIGHT scan');
    expect(share.card.blocks.filter((b) => b.kind === 'planet')).toHaveLength(2);
  });
});

function object(i: number, extra: Partial<DiscoveredObject> = {}): DiscoveredObject {
  return {
    designation: `2026 AB${i}`,
    fullName: `(2026 AB${i})`,
    firstObs: '2026-10-01',
    lastObs: '2026-10-10',
    isHazardous: false,
    kind: 'asteroid',
    ...extra,
  };
}

describe('discoveries share', () => {
  const q = { kind: 'asteroid' as const, start: new Date(2026, 9, 1), end: new Date(2026, 9, 7) };

  it('round-trips the query in the link', () => {
    const route = discoveriesRoute(q, '2026 AB1');
    const parsed = parseDiscoveriesParams(new URLSearchParams(route.split('?')[1]));
    expect(parsed).not.toBeNull();
    expect(parsed!.kind).toBe('asteroid');
    expect(parsed!.start.getTime()).toBe(q.start.getTime());
    expect(parsed!.end.getTime()).toBe(q.end.getTime());
    expect(parsed!.focus).toBe('2026 AB1');
  });

  it('rejects invalid query params', () => {
    const p = (s: string) => parseDiscoveriesParams(new URLSearchParams(s));
    expect(p('')).toBeNull();
    expect(p('kind=planet&from=2026-10-01&to=2026-10-07')).toBeNull();
    expect(p('kind=comet&from=2026-02-30&to=2026-03-07')).toBeNull();
    expect(p('kind=comet&from=2026-10-08&to=2026-10-07')).toBeNull();
  });

  it('keeps a long list under the Discord limit with the link last', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      object(i, { fullName: `(2026 AB${i} ${'x'.repeat(60)})` }),
    );
    const share = discoveriesListShare(q, many, true);
    expect(share.discordText.length).toBeLessThanOrEqual(1900);
    expect(share.discordText).toContain('has logged **400+** 🪨 asteroids first observed between');
    expect(share.discordText).toContain('(SBDB row limit reached).');
    expect(share.discordText).toMatch(/- …and \d+ more in ESSI/);
    expect(share.discordText).toContain(`(<${share.link}>)`);
    expect(share.card.blocks.filter((b) => b.kind === 'listRow')).toHaveLength(30);
  });

  it('shares one object with its status and a focus link', () => {
    const share = discoveryObjectShare(object(1, { isHazardous: true, diameterMeters: 320 }), q);
    expect(share.discordText).toContain('a new entry: the asteroid 🪨 **2026 AB1**.');
    expect(share.discordText).toContain('- **First observed:** 2026-10-01');
    expect(share.discordText).toContain('- **Status:** 🔴 Flagged as potentially hazardous');
    expect(share.discordText).toContain('- **Diameter:** 320 m');
    expect(share.discordText).not.toContain('- **Potentially hazardous:**');
    expect(share.caption).toContain('🔴 Potentially hazardous');
    expect(share.link).toContain('focus=2026+AB1');
  });

  it('labels a large, well-tracked asteroid as large (not "short tracking window")', () => {
    const share = discoveryObjectShare(object(2, { diameterMeters: 500 }), q);
    expect(share.discordText).toContain('- **Potentially hazardous:** No');
    expect(share.caption).toContain('🪨 2026 AB2\n');
    expect(share.caption).toContain('🟡 Large body (over 140 m)');
    expect(share.discordText).toContain('Large diameter (>140 m)');
  });

  it('reports an empty window', () => {
    const share = discoveriesListShare(q, [], false);
    expect(share.discordText).toContain('found no 🪨 asteroids first observed between');
    expect(share.discordText).not.toContain('Registry extract');
  });
});
