import { describe, expect, it } from 'vitest';
import {
  arrangeDiscoveries,
  expectedSeconds,
  isWideWindow,
  parseYmdInRange,
  statusCounts,
  windowDays,
} from './discoveriesClient';
import type { DiscoveredObject } from './sbdb';

describe('windowDays', () => {
  it('counts both ends (the SBDB filter is inclusive)', () => {
    expect(windowDays(new Date(2026, 9, 19), new Date(2026, 9, 19))).toBe(1);
    expect(windowDays(new Date(2026, 9, 8), new Date(2026, 9, 18))).toBe(11);
  });

  it('is not shortened by a daylight-saving change', () => {
    // Europe moved clocks forward on 29 Mar 2026: 28 → 30 Mar is still 3 days.
    expect(windowDays(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(3);
  });

  it('keeps the default 11-day window in the shortest estimate band', () => {
    expect(expectedSeconds('asteroid', 11)).toEqual({ lo: 5, hi: 30 });
    expect(isWideWindow('asteroid', 11)).toBe(false);
    expect(isWideWindow('asteroid', 12)).toBe(true);
  });
});

describe('parseYmdInRange', () => {
  const MIN = '1800-01-01';
  const MAX = '2026-10-19';

  it('reads a full date', () => {
    const d = parseYmdInRange('1850-03-07', MIN, MAX)!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1850, 2, 7]);
  });

  it('ignores a year still being typed instead of turning it into 19xx', () => {
    expect(parseYmdInRange('0002-10-19', MIN, MAX)).toBeNull();
    expect(parseYmdInRange('0020-10-19', MIN, MAX)).toBeNull();
    expect(parseYmdInRange('0185-10-19', MIN, MAX)).toBeNull();
  });

  it('rejects out-of-range and impossible dates', () => {
    expect(parseYmdInRange('2027-01-01', MIN, MAX)).toBeNull();
    expect(parseYmdInRange('2026-02-30', MIN, MAX)).toBeNull();
    expect(parseYmdInRange('', MIN, MAX)).toBeNull();
  });
});

function obj(designation: string, extra: Partial<DiscoveredObject> = {}): DiscoveredObject {
  return {
    designation,
    fullName: designation,
    firstObs: '2026-10-01',
    lastObs: '2026-10-15',
    isHazardous: false,
    kind: 'asteroid',
    ...extra,
  };
}

describe('statusCounts / arrangeDiscoveries', () => {
  const objects = [
    obj('A', { firstObs: '2026-10-03', diameterMeters: 50 }),
    obj('B', { firstObs: '2026-10-01', isHazardous: true, diameterMeters: 320 }),
    obj('C', { firstObs: '2026-10-02', lastObs: '2026-10-02' }), // short tracking → caution
    obj('D', { firstObs: '2026-10-04', diameterMeters: 500 }), // large → caution
  ];

  it('counts each status', () => {
    expect(statusCounts(objects)).toEqual({ all: 4, danger: 1, caution: 2, ok: 1 });
  });

  it('filters by status', () => {
    expect(arrangeDiscoveries(objects, 'caution', 'oldest').map((o) => o.designation)).toEqual(['C', 'D']);
    expect(arrangeDiscoveries(objects, 'danger', 'oldest').map((o) => o.designation)).toEqual(['B']);
  });

  it('sorts by first observation or size (unknown sizes last)', () => {
    expect(arrangeDiscoveries(objects, 'all', 'oldest').map((o) => o.designation)).toEqual(['B', 'C', 'A', 'D']);
    expect(arrangeDiscoveries(objects, 'all', 'newest').map((o) => o.designation)).toEqual(['D', 'A', 'C', 'B']);
    expect(arrangeDiscoveries(objects, 'all', 'largest').map((o) => o.designation)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('leaves the input untouched', () => {
    arrangeDiscoveries(objects, 'all', 'newest');
    expect(objects.map((o) => o.designation)).toEqual(['A', 'B', 'C', 'D']);
  });
});
