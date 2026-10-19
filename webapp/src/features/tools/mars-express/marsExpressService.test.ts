// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  arrivalMinutes,
  consolidated,
  currentStop,
  isCurrentEntry,
  minutesUntil,
  nameFor,
  parseSchedule,
  rangeText,
  zoneTiming,
  type TrainStop,
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

describe('consolidated', () => {
  it('groups the opening 259 run and marks it current', () => {
    const entries = consolidated(0, stops);
    const first = entries[0]!;
    expect(first).toMatchObject({ startMinute: 0, endMinute: 1, zone: 259, nextHour: false });
    expect(first.name).toBe('New Haven');
    expect(rangeText(first)).toBe(':00-01');
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

/** 10:MM:SS on a fixed day, local time (the schedule runs on the local minute). */
const at = (minute: number, second = 0, hour = 10) => new Date(2026, 0, 1, hour, minute, second, 0);
const hhmm = (d: Date) => `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
const singleZone = (minutes: number[]): TrainStop[] => minutes.map((minute) => ({ minute, zone: 1, name: null }));
const ALL_HOUR = Array.from({ length: 60 }, (_, minute) => minute);

describe('arrivalMinutes', () => {
  it('counts each stay once, at its first minute', () => {
    expect(arrivalMinutes(234, stops)).toEqual([49]); // parked :49-56
    expect(arrivalMinutes(259, stops)).toEqual([0]); // :00-01
    expect(arrivalMinutes(322, stops)).toEqual([14, 31]); // two stays an hour
    expect(arrivalMinutes(307, stops)).toEqual([4]);
  });

  it('follows a stay across the top of the hour', () => {
    expect(arrivalMinutes(1, singleZone([58, 59, 0, 1]))).toEqual([58]);
  });

  it('returns [] for an unknown zone or one held all hour', () => {
    expect(arrivalMinutes(99999, stops)).toEqual([]);
    expect(arrivalMinutes(1, singleZone(ALL_HOUR))).toEqual([]);
  });
});

describe('zoneTiming', () => {
  it.each([
    // zone, label, now, leaves at, next arrival, minutes until it
    [234, '10:50', at(50), '10:57', '11:49', 59],
    [307, '10:04:30', at(4, 30), '10:05', '11:04', 60],
    [282, '10:41', at(41), '10:44', '11:39', 58],
    [259, '10:00', at(0), '10:02', '11:00', 60],
    [322, '10:14:20', at(14, 20), '10:16', '10:31', 17],
  ])('zone %i at %s: train here, next arrival after it leaves', (zone, _label, now, leaves, next, minutes) => {
    const t = zoneTiming(zone, stops, now, 3);
    expect(t.here).toBe(true);
    expect(hhmm(t.leavesAt!)).toBe(leaves);
    expect(hhmm(t.arrivals[0]!)).toBe(next);
    expect(minutesUntil(t.arrivals[0]!, now)).toBe(minutes);
  });

  it('lists the next arrivals by stay, not every minute of a stay', () => {
    const t = zoneTiming(234, stops, at(40), 3);
    expect(t.here).toBe(false);
    expect(t.leavesAt).toBeNull();
    expect(t.arrivals.map(hhmm)).toEqual(['10:49', '11:49', '12:49']);
    expect(minutesUntil(t.arrivals[0]!, at(40))).toBe(9);
    expect(zoneTiming(322, stops, at(14, 20), 3).arrivals.map(hhmm)).toEqual(['10:31', '11:14', '11:31']);
  });

  it("rolls to the next hour once this hour's visit is past", () => {
    const t = zoneTiming(259, stops, at(30), 2);
    expect(t.here).toBe(false);
    expect(t.arrivals.map(hhmm)).toEqual(['11:00', '12:00']);
    expect(minutesUntil(t.arrivals[0]!, at(30))).toBe(30);
  });

  it('handles a stay across the top of the hour', () => {
    const wrapping = singleZone([58, 59, 0, 1]);
    const early = zoneTiming(1, wrapping, at(0, 30), 2);
    expect(early.here).toBe(true);
    expect(hhmm(early.leavesAt!)).toBe('10:02');
    expect(early.arrivals.map(hhmm)).toEqual(['10:58', '11:58']);

    const late = zoneTiming(1, wrapping, at(58, 30), 1);
    expect(hhmm(late.leavesAt!)).toBe('11:02');
    expect(late.arrivals.map(hhmm)).toEqual(['11:58']);
  });

  it('copes with an unknown zone, a zone held all hour and count <= 0', () => {
    expect(zoneTiming(99999, stops, at(0), 3)).toEqual({ here: false, leavesAt: null, arrivals: [] });
    expect(zoneTiming(1, singleZone(ALL_HOUR), at(10), 3)).toEqual({ here: true, leavesAt: null, arrivals: [] });
    expect(zoneTiming(259, stops, at(30), 0).arrivals).toEqual([]);
  });
});

describe('minutesUntil', () => {
  it('rounds up to whole minutes and never goes negative', () => {
    expect(minutesUntil(at(1), at(0, 59))).toBe(1);
    expect(minutesUntil(at(1), at(0, 30))).toBe(1);
    expect(minutesUntil(at(0, 0, 11), at(0))).toBe(60);
    expect(minutesUntil(at(0), at(1))).toBe(0);
  });
});
