import { describe, expect, it } from 'vitest';
import {
  computeStatus,
  discoveredObjectFromJson,
  discoveredObjectToJson,
  displayNameOf,
  extractSbdbPdes,
  filterHistorical,
  parseSbdbObjects,
  statusExplanation,
  trackingPeriodDays,
  type DiscoveredObject,
} from './sbdb';

// The exact excerpt from tools-live spec §5.4.
const QUERY_RESPONSE = {
  signature: { source: 'NASA/JPL Small-Body Database Query API', version: '1.5' },
  count: 2,
  fields: ['full_name', 'pdes', 'first_obs', 'last_obs', 'pha'],
  data: [
    ['       1P/Halley', '1P', '1835-08-05', '2017-03-22', null],
    ['       (2020 AB1)', '2020 AB1', '2020-01-15', '2020-04-22', 'N'],
  ],
};

describe('parseSbdbObjects', () => {
  it('reads columns by name and sorts ascending by first_obs', () => {
    const objs = parseSbdbObjects(QUERY_RESPONSE, 'comet');
    expect(objs).toHaveLength(2);
    expect(objs[0]!.designation).toBe('1P'); // 1835 sorts before 2020
    expect(objs[1]!.designation).toBe('2020 AB1');
    expect(objs[0]!.fullName).toBe('       1P/Halley');
  });

  it('drops rows without pdes', () => {
    const objs = parseSbdbObjects(
      { fields: ['full_name', 'pdes'], data: [['X', ''], ['Y', 'Y1']] },
      'asteroid',
    );
    expect(objs).toHaveLength(1);
    expect(objs[0]!.designation).toBe('Y1');
  });

  it('converts diameter from km to metres and reads pha/albedo tolerantly', () => {
    const objs = parseSbdbObjects(
      {
        fields: ['pdes', 'diameter', 'albedo', 'pha'],
        data: [['433', '0.5', 0.25, 'Y']],
      },
      'asteroid',
    );
    expect(objs[0]!.diameterMeters).toBe(500);
    expect(objs[0]!.albedo).toBe(0.25);
    expect(objs[0]!.isHazardous).toBe(true);
  });

  it('handles reordered fields (never assumes column order)', () => {
    const objs = parseSbdbObjects(
      { fields: ['pha', 'pdes', 'first_obs'], data: [['N', '1P', '1835-08-05']] },
      'comet',
    );
    expect(objs[0]!.designation).toBe('1P');
    expect(objs[0]!.firstObs).toBe('1835-08-05');
    expect(objs[0]!.isHazardous).toBe(false);
  });

  it('returns [] for a malformed payload', () => {
    expect(parseSbdbObjects(null, 'comet')).toEqual([]);
    expect(parseSbdbObjects({ fields: 'x', data: [] }, 'comet')).toEqual([]);
  });
});

describe('displayNameOf', () => {
  it('trims and strips a single wrapping paren pair', () => {
    expect(displayNameOf({ fullName: '       1P/Halley', designation: '1P' } as DiscoveredObject)).toBe(
      '1P/Halley',
    );
    expect(
      displayNameOf({ fullName: '       (2020 AB1)', designation: '2020 AB1' } as DiscoveredObject),
    ).toBe('2020 AB1');
  });

  it('falls back to designation when empty', () => {
    expect(displayNameOf({ fullName: '   ', designation: 'D1' } as DiscoveredObject)).toBe('D1');
  });
});

describe('trackingPeriodDays', () => {
  it('floors last − first in days', () => {
    expect(
      trackingPeriodDays({ firstObs: '2020-01-01', lastObs: '2020-01-11' } as DiscoveredObject),
    ).toBe(10);
  });
  it('is null unless both dates parse', () => {
    expect(trackingPeriodDays({ firstObs: '2020-01-01' } as DiscoveredObject)).toBeNull();
    expect(trackingPeriodDays({} as DiscoveredObject)).toBeNull();
  });
});

describe('computeStatus (top-down, first match wins)', () => {
  const base: DiscoveredObject = {
    designation: 'x',
    fullName: 'x',
    firstObs: '2000-01-01',
    lastObs: '2000-06-01',
    isHazardous: false,
    kind: 'asteroid',
  };

  it('danger when hazardous, before anything else', () => {
    expect(computeStatus({ ...base, isHazardous: true })).toBe('danger');
  });
  it('caution for a large asteroid (>140 m)', () => {
    expect(computeStatus({ ...base, diameterMeters: 200 })).toBe('caution');
  });
  it('caution for a short tracking window (<3 days)', () => {
    expect(computeStatus({ ...base, firstObs: '2000-01-01', lastObs: '2000-01-02' })).toBe(
      'caution',
    );
  });
  it('caution when obs dates missing (days=0, unknown never returned)', () => {
    expect(computeStatus({ ...base, firstObs: undefined, lastObs: undefined })).toBe('caution');
  });
  it('ok otherwise', () => {
    expect(computeStatus({ ...base, diameterMeters: 50 })).toBe('ok');
  });

  it('explanation uses its own evaluation order', () => {
    expect(statusExplanation({ ...base, isHazardous: true })).toContain('PHA=Y');
    expect(
      statusExplanation({ ...base, firstObs: '2000-01-01', lastObs: '2000-01-02' }),
    ).toContain('Short tracking window');
    expect(statusExplanation({ ...base, diameterMeters: 200 })).toContain('Large diameter');
  });
});

describe('filterHistorical', () => {
  const objs = parseSbdbObjects(QUERY_RESPONSE, 'comet');
  it('keeps only rows inside [start, end] by first_obs', () => {
    expect(filterHistorical(objs, '1800-01-01', '1900-01-01').map((o) => o.designation)).toEqual([
      '1P',
    ]);
    expect(filterHistorical(objs, '1800-01-01', '2025-01-01')).toHaveLength(2);
  });
  it('drops rows with missing/unparseable first_obs', () => {
    const withMissing: DiscoveredObject[] = [
      { designation: 'A', fullName: 'A', isHazardous: false, kind: 'comet' },
    ];
    expect(filterHistorical(withMissing, '1000-01-01', '3000-01-01')).toEqual([]);
  });
});

describe('extractSbdbPdes', () => {
  it('reads object.pdes for a single match', () => {
    expect(extractSbdbPdes({ object: { pdes: '1', fullname: '1 Ceres', kind: 'an' } })).toBe('1');
  });
  it('reads list[0].pdes for an ambiguous match', () => {
    expect(
      extractSbdbPdes({ code: 300, list: [{ pdes: '1996', name: 'Adams' }, { pdes: '(2009 BJ81)' }] }),
    ).toBe('1996');
  });
  it('returns null when no pdes present', () => {
    expect(extractSbdbPdes({ object: {} })).toBeNull();
    expect(extractSbdbPdes(null)).toBeNull();
  });
});

describe('DiscoveredObject JSON round-trip', () => {
  it('serialises and restores', () => {
    const o: DiscoveredObject = {
      designation: '433',
      fullName: '433 Eros',
      firstObs: '1893-10-29',
      lastObs: '2020-01-01',
      isHazardous: false,
      diameterMeters: 16800,
      albedo: 0.25,
      kind: 'asteroid',
    };
    const restored = discoveredObjectFromJson(discoveredObjectToJson(o));
    expect(restored).toEqual(o);
  });
});
