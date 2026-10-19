import { describe, expect, it } from 'vitest';
import { PLANETS, searchSpanText } from './planets';

describe('Full-scan windows', () => {
  it('looks far enough ahead for Mars (up to ~69 days in one sector)', () => {
    const mars = PLANETS.find((p) => p.name === 'Mars')!;
    expect(mars.window.broadDays).toBeGreaterThanOrEqual(75);
    expect(searchSpanText(mars)).toBe('90 days');
  });

  it('words long windows in years', () => {
    expect(searchSpanText(PLANETS.find((p) => p.name === 'Saturn')!)).toBe('4 years');
    expect(searchSpanText(PLANETS.find((p) => p.name === 'Pluto')!)).toBe('30 years');
  });
});
