// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  alertsForArrival,
  consolidated,
  currentStop,
  isCurrentEntry,
  nameFor,
  nextArrivals,
  nextOccurrences,
  parseSchedule,
  rangeText,
} from './marsExpressService';

const stops = parseSchedule(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../public/catalog/train_schedule.json', import.meta.url)),
      'utf-8',
    ),
  ),
);

describe('parseSchedule', () => {
  it('loads 60 stops sorted by minute', () => {
    expect(stops.length).toBe(60);
    expect(stops.map((s) => s.minute)).toEqual(Array.from({ length: 60 }, (_, i) => i));
  });
});

describe('nameFor', () => {
  it('returns the first non-null name (zone 301 → Redwater Junction)', () => {
    expect(nameFor(301, stops)).toBe('Redwater Junction');
  });
  it('returns null for a zone that is always unnamed', () => {
    expect(nameFor(307, stops)).toBeNull();
  });
});

describe('currentStop', () => {
  it('finds the stop at a minute', () => {
    expect(currentStop(0, stops)?.name).toBe('New Haven');
    expect(currentStop(22, stops)?.zone).toBe(294);
  });
});

describe('nextArrivals', () => {
  it('returns future minutes this hour', () => {
    expect(nextArrivals(259, 0, stops)).toEqual([1]);
  });
  it('wraps to +60 when nothing is left this hour', () => {
    expect(nextArrivals(259, 30, stops)).toEqual([60, 61]);
  });
});

describe('consolidated', () => {
  it('groups the opening 259 run and marks it current', () => {
    const entries = consolidated(0, stops);
    const first = entries[0]!;
    expect(first).toMatchObject({ startMinute: 0, endMinute: 1, zone: 259, nextHour: false });
    expect(first.name).toBe('New Haven');
    expect(rangeText(first)).toBe(':00–01');
    expect(isCurrentEntry(first, 0)).toBe(true);
  });

  it('wraps earlier minutes into a next-hour pass', () => {
    const entries = consolidated(5, stops);
    // Everything before minute 5 becomes nextHour ranges at the tail.
    expect(entries.some((e) => e.nextHour)).toBe(true);
    const wrapped = entries.find((e) => e.nextHour)!;
    expect(rangeText(wrapped).endsWith('+')).toBe(true);
    expect(isCurrentEntry(wrapped, 5)).toBe(false);
  });
});

describe('nextOccurrences', () => {
  it('returns instants strictly after now, rolling on an exact hit', () => {
    const now = new Date(2026, 0, 1, 10, 0, 0, 0);
    const occ = nextOccurrences(259, stops, 2, now); // zone 259 at minutes 0,1
    expect(occ).toHaveLength(2);
    expect(occ[0]!.getHours()).toBe(10);
    expect(occ[0]!.getMinutes()).toBe(1); // 10:00 skipped (not strictly after)
    expect(occ[1]!.getHours()).toBe(11);
    expect(occ[1]!.getMinutes()).toBe(0);
  });

  it('wraps to the next hour when the visits are already past', () => {
    const now = new Date(2026, 0, 1, 10, 5, 0, 0);
    const occ = nextOccurrences(259, stops, 2, now);
    expect(occ[0]!.getHours()).toBe(11);
    expect(occ[0]!.getMinutes()).toBe(0);
    expect(occ[1]!.getMinutes()).toBe(1);
  });

  it('returns [] for count <= 0 or an unknown zone', () => {
    const now = new Date(2026, 0, 1, 10, 0, 0, 0);
    expect(nextOccurrences(259, stops, 0, now)).toEqual([]);
    expect(nextOccurrences(99999, stops, 3, now)).toEqual([]);
  });
});

describe('alertsForArrival', () => {
  it('returns −2 min, −1 min, and the arrival', () => {
    const arrival = new Date(2026, 0, 1, 10, 30, 0, 0);
    const [a, b, c] = alertsForArrival(arrival);
    expect(arrival.getTime() - a!.getTime()).toBe(120_000);
    expect(arrival.getTime() - b!.getTime()).toBe(60_000);
    expect(c!.getTime()).toBe(arrival.getTime());
  });
});
