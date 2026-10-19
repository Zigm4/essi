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

  it('writes a Discord message that ends with the link, without preview', () => {
    const share = trackerShare(TRACK);
    expect(share.discordText).toContain('**1P/Halley**');
    expect(share.discordText).toContain('**Sector 7**');
    expect(share.discordText).toContain('3.512 SL');
    expect(share.discordText.endsWith(`<${share.link}>`)).toBe(true);
    expect(share.card.blocks.some((b) => b.kind === 'kv' && b.label === 'Sector')).toBe(true);
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
    expect(share.discordText).toContain('LIGHT');
    expect(share.discordText).toContain('**Mercury** · Sector 3 · 0.39 SL');
    expect(share.discordText).toContain('→ sector 12');
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
    expect(share.discordText).toContain('400+ found');
    expect(share.discordText.endsWith(`<${share.link}>`)).toBe(true);
    expect(share.card.blocks.filter((b) => b.kind === 'listRow')).toHaveLength(30);
  });

  it('shares one object with its status and a focus link', () => {
    const share = discoveryObjectShare(object(1, { isHazardous: true, diameterMeters: 320 }), q);
    expect(share.discordText).toContain('**2026 AB1**');
    expect(share.discordText).toContain('Potentially hazardous');
    expect(share.discordText).toContain('Diameter 320 m');
    expect(share.link).toContain('focus=2026+AB1');
  });
});
