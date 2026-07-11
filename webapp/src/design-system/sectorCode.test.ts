import { describe, expect, it } from 'vitest';
import { randomSectorSeed, sectorCodeText, sectorCodeValue } from './sectorCode';

describe('sectorCodeValue', () => {
  it('applies the exact formula 100 + ((seed + floor(|offset|/4)) % 900)', () => {
    expect(sectorCodeValue(0, 0)).toBe(100);
    expect(sectorCodeValue(347, 0)).toBe(447);
    expect(sectorCodeValue(0, 4)).toBe(101);
    expect(sectorCodeValue(0, 7.9)).toBe(101); // ticks change every 4px
    expect(sectorCodeValue(0, 8)).toBe(102);
  });

  it('uses the absolute scroll offset', () => {
    expect(sectorCodeValue(10, -40)).toBe(sectorCodeValue(10, 40));
  });

  it('always stays in 100..999', () => {
    for (let seed = 0; seed < 900; seed += 37) {
      for (let offset = 0; offset < 40_000; offset += 997) {
        const value = sectorCodeValue(seed, offset);
        expect(value).toBeGreaterThanOrEqual(100);
        expect(value).toBeLessThanOrEqual(999);
      }
    }
  });

  it('wraps modulo 900', () => {
    expect(sectorCodeValue(899, 4)).toBe(100); // 899 + 1 = 900 → % 900 = 0
  });

  it('renders as ESSI//NNN', () => {
    expect(sectorCodeText(123, 0)).toBe('ESSI//223');
  });
});

describe('randomSectorSeed', () => {
  it('stays in 0..899', () => {
    for (let i = 0; i < 200; i++) {
      const seed = randomSectorSeed();
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(899);
      expect(Number.isInteger(seed)).toBe(true);
    }
  });
});
