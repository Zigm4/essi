import { describe, expect, it } from 'vitest';
import { formatRelativeDate } from './relativeDate';

const now = new Date(2026, 6, 11, 15, 0, 0); // 11 Jul 2026 15:00 local

function minutesAgo(m: number): Date {
  return new Date(now.getTime() - m * 60_000);
}

describe('formatRelativeDate', () => {
  it('formats future dates as full local date-time', () => {
    const future = new Date(2026, 6, 5, 14, 30);
    expect(formatRelativeDate(future, new Date(2026, 6, 1))).toBe('5 Jul 2026, 14:30');
  });

  it('zero-pads hours and minutes for future dates', () => {
    const future = new Date(2026, 0, 2, 9, 5);
    expect(formatRelativeDate(future, new Date(2026, 0, 1))).toBe('2 Jan 2026, 09:05');
  });

  it('says just now under a minute', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 30_000), now)).toBe('just now');
  });

  it('uses minutes under an hour', () => {
    expect(formatRelativeDate(minutesAgo(1), now)).toBe('1 min ago');
    expect(formatRelativeDate(minutesAgo(59), now)).toBe('59 min ago');
  });

  it('uses hours under a day', () => {
    expect(formatRelativeDate(minutesAgo(60), now)).toBe('1h ago');
    expect(formatRelativeDate(minutesAgo(23 * 60 + 59), now)).toBe('23h ago');
  });

  it('uses days under a week', () => {
    expect(formatRelativeDate(minutesAgo(24 * 60), now)).toBe('1d ago');
    expect(formatRelativeDate(minutesAgo(6 * 24 * 60), now)).toBe('6d ago');
  });

  it('uses weeks under 30 days', () => {
    expect(formatRelativeDate(minutesAgo(7 * 24 * 60), now)).toBe('1w ago');
    expect(formatRelativeDate(minutesAgo(29 * 24 * 60), now)).toBe('4w ago');
  });

  it('uses months under a year', () => {
    expect(formatRelativeDate(minutesAgo(30 * 24 * 60), now)).toBe('1 mo ago');
    expect(formatRelativeDate(minutesAgo(364 * 24 * 60), now)).toBe('12 mo ago');
  });

  it('falls back to the full date at a year or more', () => {
    expect(formatRelativeDate(new Date(2025, 6, 5), new Date(2026, 6, 11))).toBe('5 Jul 2025');
  });
});
