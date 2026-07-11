import { describe, expect, it } from 'vitest';
import {
  computeDistanceSL,
  computeScanMetrics,
  computeSector,
  computeTrackerMetrics,
} from './sectorMath';

describe('computeSector', () => {
  it('maps the four cardinal axes counter-clockwise from +X', () => {
    expect(computeSector(1, 0)).toBe(1); // theta 0
    expect(computeSector(0, 1)).toBe(4); // theta pi/2 -> raw 3
    expect(computeSector(-1, 0)).toBe(7); // theta pi -> raw 6
    expect(computeSector(0, -1)).toBe(10); // theta 3pi/2 -> raw 9
  });

  it('stays within 1..12 for arbitrary vectors', () => {
    for (const [x, y] of [
      [3, 4],
      [-5, 2],
      [-1, -8],
      [7, -3],
      [0.0001, -0.0002],
    ] as const) {
      const s = computeSector(x, y);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(12);
    }
  });
});

describe('computeDistanceSL', () => {
  it('floors miles / 3,000,000', () => {
    // 10,000,000 km * 0.621371 = 6,213,710 mi -> /3e6 = 2.07 -> floor 2
    expect(computeDistanceSL(10_000_000, 0)).toBe(2);
    // just under one SL floors to 0
    expect(computeDistanceSL(1_000_000, 0)).toBe(0);
  });

  it('uses hypot (Z ignored, only X/Y)', () => {
    expect(computeScanMetrics(0, 10_000_000)).toEqual({ sector: 4, distanceSL: 2 });
  });
});

describe('computeTrackerMetrics', () => {
  it('converts a 1-AU +X vector correctly', () => {
    const KM_PER_AU = 149_597_870.7;
    const m = computeTrackerMetrics(KM_PER_AU, 0, 0);
    expect(m.xAU).toBeCloseTo(1, 9);
    expect(m.yAU).toBeCloseTo(0, 9);
    expect(m.distanceAU).toBeCloseTo(1, 9);
    expect(m.sector).toBe(1);
    // 149,597,870.7 * 0.621371 / 3e6 ≈ 30.985
    expect(m.slExact).toBeCloseTo(30.985, 2);
    expect(m.slRounded).toBe(Math.round(m.slExact * 1000) / 1000);
    expect(m.slFloor).toBe(30);
  });

  it('preserves Z in AU while ignoring it for sector/distance', () => {
    const KM_PER_AU = 149_597_870.7;
    const withZ = computeTrackerMetrics(KM_PER_AU, 0, KM_PER_AU * 5);
    const noZ = computeTrackerMetrics(KM_PER_AU, 0, 0);
    expect(withZ.zAU).toBeCloseTo(5, 6);
    expect(withZ.sector).toBe(noZ.sector);
    expect(withZ.distanceAU).toBeCloseTo(noZ.distanceAU, 9);
  });

  it('slFloor can be less than slRounded (floor-warning condition)', () => {
    // Pick a vector whose slExact is e.g. 2.9xx -> floor 2, rounded ~2.9xx
    const KM_PER_AU = 149_597_870.7;
    const m = computeTrackerMetrics(KM_PER_AU * 0.1, 0, 0); // ~3.0985 SL
    expect(m.slFloor).toBeLessThan(m.slRounded);
  });
});
