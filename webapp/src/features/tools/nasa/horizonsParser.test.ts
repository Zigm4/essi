import { describe, expect, it } from 'vitest';
import {
  collapsePreview,
  HorizonsFormatError,
  parseHorizonsDate,
  parseHorizonsEphemeris,
} from './horizonsParser';

// The exact sample excerpt from tools-live spec §4.7.
const SAMPLE = `*******************************************************************************
 Ephemeris / WWW_USER Mon May  4 12:00:00 2026 Pasadena, USA
$$SOE
2461164.500000000 = A.D. 2026-May-04 00:00:00.0000 TDB
 X =-3.012345678901234E+07 Y = 4.567890123456789E+07 Z = 1.234567890123456E+06
 VX=-5.123456789012345E+01 VY=-2.345678901234567E+01 VZ= 3.456789012345678E+00
 LT= 1.234567890123456E+02 RG= 5.678901234567890E+07 RR= 1.234567890123456E+01
$$EOE
*******************************************************************************`;

describe('parseHorizonsDate', () => {
  it('parses yyyy-MMM-dd HH:mm:ss.SSSS as UTC', () => {
    const d = parseHorizonsDate('2026-May-04 00:00:00.0000');
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBe(Date.UTC(2026, 4, 4, 0, 0, 0, 0));
  });

  it('rounds fractional seconds to milliseconds', () => {
    const d = parseHorizonsDate('2026-Dec-31 23:59:58.5000');
    expect(d!.getTime()).toBe(Date.UTC(2026, 11, 31, 23, 59, 58, 500));
  });

  it('parses regardless of month case, locale-independent', () => {
    expect(parseHorizonsDate('2020-jan-01 12:00:00')!.getTime()).toBe(
      Date.UTC(2020, 0, 1, 12, 0, 0, 0),
    );
  });

  it('returns null on a malformed month or shape', () => {
    expect(parseHorizonsDate('2026-Zzz-04 00:00:00.0')).toBeNull();
    expect(parseHorizonsDate('not a date')).toBeNull();
  });
});

describe('parseHorizonsEphemeris', () => {
  it('extracts the single sample position with X/Y/Z in km', () => {
    const rows = parseHorizonsEphemeris(SAMPLE);
    expect(rows).toHaveLength(1);
    const p = rows[0]!;
    expect(p.x).toBeCloseTo(-3.012345678901234e7, 0);
    expect(p.y).toBeCloseTo(4.567890123456789e7, 0);
    expect(p.z).toBeCloseTo(1.234567890123456e6, 0);
    expect(p.date.getTime()).toBe(Date.UTC(2026, 4, 4, 0, 0, 0, 0));
  });

  it('does not match the VX/VY/VZ velocity line (anchor guard)', () => {
    // Only one position despite the velocity line also carrying X-ish tokens.
    expect(parseHorizonsEphemeris(SAMPLE)).toHaveLength(1);
  });

  it('parses multiple date/vector pairs in order', () => {
    const text = `$$SOE
2461164.5 = A.D. 2026-May-04 00:00:00.0000 TDB
 X = 1.0E+06 Y = 2.0E+06 Z = 3.0E+06
2461165.5 = A.D. 2026-May-05 00:00:00.0000 TDB
 X =-4.0E+06 Y = 5.0E+06 Z =-6.0E+06
$$EOE`;
    const rows = parseHorizonsEphemeris(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.x).toBe(1e6);
    expect(rows[1]!.x).toBe(-4e6);
    expect(rows[1]!.date.getTime()).toBe(Date.UTC(2026, 4, 5, 0, 0, 0, 0));
  });

  it('returns [] when $$SOE is present but no vectors follow', () => {
    expect(parseHorizonsEphemeris('$$SOE\n(no rows here)\n$$EOE')).toEqual([]);
  });

  it('reads to end of text when $$EOE is missing', () => {
    const text = `$$SOE
2461164.5 = A.D. 2026-May-04 00:00:00.0000 TDB
 X = 7.0E+06 Y = 8.0E+06 Z = 9.0E+06`;
    expect(parseHorizonsEphemeris(text)).toHaveLength(1);
  });

  it('throws HorizonsFormatError with a collapsed preview when $$SOE is absent', () => {
    try {
      parseHorizonsEphemeris('  API SERVER   BUSY\n\n try   again  ');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HorizonsFormatError);
      expect((e as HorizonsFormatError).preview).toBe('API SERVER BUSY try again');
    }
  });

  it('skips a vector whose preceding date line is malformed', () => {
    const text = `$$SOE
= A.D. not-a-real-date TDB
 X = 1.0E+06 Y = 2.0E+06 Z = 3.0E+06
$$EOE`;
    expect(parseHorizonsEphemeris(text)).toEqual([]);
  });
});

describe('collapsePreview', () => {
  it('collapses whitespace, trims, and caps at 200 chars', () => {
    expect(collapsePreview('  a\n\n  b\t c  ')).toBe('a b c');
    expect(collapsePreview('x'.repeat(300))).toHaveLength(200);
  });
});
