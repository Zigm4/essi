import { describe, expect, it } from 'vitest';
import { expectedSeconds, isWideWindow, parseYmdInRange, windowDays } from './discoveriesClient';

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
