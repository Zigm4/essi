import { describe, expect, it, vi } from 'vitest';
import type { TrackedObject } from './catalog';
import { TrackerMpcLookupError } from './errors';
import {
  buildCommandID,
  parseHorizonsIndexSearch,
  resolveMPC,
  sbdbChoices,
  stripTrailingParenthetical,
  stripWrappingParens,
  type SbdbLookupFn,
} from './trackerClient';

const CATALOG: TrackedObject[] = [
  { name: 'Ceres', identifier: '1', kind: 'asteroid' },
  { name: 'C/2024 G3 (ATLAS)', identifier: 'C/2024 G3 (ATLAS)', kind: 'comet' },
];

const neverCalled: SbdbLookupFn = () => {
  throw new Error('lookup should not run');
};

describe('resolveMPC tiers', () => {
  it('tier 0 - prefilled mpcID wins outright', async () => {
    expect(
      await resolveMPC({ name: 'anything', kind: 'asteroid', mpcID: '99942' }, CATALOG, neverCalled),
    ).toBe('99942');
  });

  it('tier 1 - exact catalog match (case-insensitive) → identifier', async () => {
    expect(await resolveMPC({ name: 'ceres', kind: 'asteroid' }, CATALOG, neverCalled)).toBe('1');
  });

  it('throws when the name is empty after cleaning', async () => {
    await expect(resolveMPC({ name: '()', kind: 'asteroid' }, CATALOG, neverCalled)).rejects.toBeInstanceOf(
      TrackerMpcLookupError,
    );
  });

  it('tier 2 - digits-only asteroid is used as-is, no network', async () => {
    expect(await resolveMPC({ name: '433', kind: 'asteroid' }, CATALOG, neverCalled)).toBe('433');
  });

  it('tier 3 - SBDB lookup returns a pdes', async () => {
    const lookup = vi.fn<SbdbLookupFn>().mockResolvedValue('1P');
    expect(await resolveMPC({ name: 'Halley', kind: 'comet' }, CATALOG, lookup)).toBe('1P');
    expect(lookup).toHaveBeenCalledWith('Halley', 'comet');
  });

  it('tier 3 - retries with the trailing parenthetical stripped', async () => {
    const lookup = vi
      .fn<SbdbLookupFn>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('2024 G3');
    // Use a comet name NOT in the catalog so tier 1 does not short-circuit.
    const got = await resolveMPC({ name: 'C/2099 Z9 (TEST)', kind: 'comet' }, CATALOG, lookup);
    expect(got).toBe('2024 G3');
    expect(lookup).toHaveBeenNthCalledWith(1, 'C/2099 Z9 (TEST)', 'comet');
    expect(lookup).toHaveBeenNthCalledWith(2, 'C/2099 Z9', 'comet');
  });

  it('tier 4 - passthrough when the cleaned name has a digit and a letter', async () => {
    const lookup = vi.fn<SbdbLookupFn>().mockResolvedValue(null);
    expect(await resolveMPC({ name: '2024 G3', kind: 'comet' }, CATALOG, lookup)).toBe('2024 G3');
  });

  it('throws when nothing resolves (no digits+letters, lookup empty)', async () => {
    const lookup = vi.fn<SbdbLookupFn>().mockResolvedValue(null);
    await expect(
      resolveMPC({ name: 'Nibiru', kind: 'comet' }, CATALOG, lookup),
    ).rejects.toBeInstanceOf(TrackerMpcLookupError);
  });
});

describe('buildCommandID', () => {
  it('strips C//P/ prefix and trailing parenthetical for comets and asks Horizons by designation', () => {
    expect(buildCommandID('C/2024 G3 (ATLAS)', 'comet')).toBe('DES=2024 G3;CAP;NOFRAG');
    expect(buildCommandID('P/2003 CP7', 'comet')).toBe('DES=2003 CP7;CAP;NOFRAG');
  });

  it('never sends a bare periodic-comet number (Horizons reads 1P / 2P as Pluto moons)', () => {
    expect(buildCommandID('1P', 'comet')).toBe('DES=1P;CAP;NOFRAG'); // 1P/Halley, not Kerberos
    expect(buildCommandID('2P', 'comet')).toBe('DES=2P;CAP;NOFRAG'); // 2P/Encke, not Styx
    expect(buildCommandID('67P', 'comet')).toBe('DES=67P;CAP;NOFRAG');
    expect(buildCommandID('1P/Halley', 'comet')).toBe('DES=1P;CAP;NOFRAG');
    expect(buildCommandID('73P-B', 'comet')).toBe('DES=73P-B;CAP;NOFRAG');
  });

  it('appends a semicolon to numbered asteroids (Ceres, not Mercury barycenter)', () => {
    expect(buildCommandID('1', 'asteroid')).toBe('1;');
    expect(buildCommandID('99942', 'asteroid')).toBe('99942;');
    // Comets selected + a number: still a small body, never Mercury's barycenter.
    expect(buildCommandID('1', 'comet')).toBe('1;');
    expect(buildCommandID('301', 'comet')).toBe('301;');
  });

  it('leaves non-numeric asteroid designations untouched', () => {
    expect(buildCommandID('2020 AB1', 'asteroid')).toBe('2020 AB1');
  });
});

describe('name helpers', () => {
  it('stripWrappingParens', () => {
    expect(stripWrappingParens('  (2020 AB1) ')).toBe('2020 AB1');
    expect(stripWrappingParens('1P/Halley')).toBe('1P/Halley');
  });
  it('stripTrailingParenthetical', () => {
    expect(stripTrailingParenthetical('C/2024 G3 (ATLAS)')).toBe('C/2024 G3');
    expect(stripTrailingParenthetical('433 Eros')).toBe('433 Eros');
  });
});

// Live Horizons replies (Oct 2026), trimmed.
const HZ_NONE = `*******************************************************************************
JPL/DASTCOM            Small-body Index Search Results     2026-Oct-19 02:01:16

 Comet AND asteroid index search:

   NAME = XYZNOTHING123;

 Matching small-bodies: 
    No matches found.
*******************************************************************************
`;

const HZ_HALLEY = `*******************************************************************************
JPL/DASTCOM            Small-body Index Search Results     2026-Oct-19 02:01:18

 Comet AND asteroid index search:

   NAME = Halley;

 Matching small-bodies: 

    Record #  Epoch-yr  Primary Desig  >MATCH NAME<
    --------  --------  -------------  -------------------------
        2688            1982 HG1        Halley
    90000001    -239    1P              Halley
    90000029    1910    1P              Halley
    90000030    1968    1P              Halley

 (31 matches. To SELECT, enter record # (integer), followed by semi-colon.)
*******************************************************************************
`;

const HZ_ATLAS = `*******************************************************************************
JPL/DASTCOM            Small-body Index Search Results     2026-Oct-19 02:01:27

 Comets-only index search:

   NAME = ATLAS; CAP < 2461393.5; NOFRAG;

 Matching small-bodies: 

    Record #  Epoch-yr  Primary Desig  >MATCH NAME<
    --------  --------  -------------  -------------------------
${Array.from({ length: 14 }, (_, i) => `    9000${4900 + i}    2025    C/2025 A${i + 1}       ATLAS`).join('\n')}

 (14 matches. To SELECT, enter record # (integer), followed by semi-colon.)
*******************************************************************************
`;

describe('parseHorizonsIndexSearch', () => {
  it('reads "No matches found" as not found', () => {
    expect(parseHorizonsIndexSearch(HZ_NONE)).toEqual({ kind: 'none' });
  });

  it('lists each object once, with its kind', () => {
    const r = parseHorizonsIndexSearch(HZ_HALLEY);
    expect(r).toEqual({
      kind: 'choices',
      more: 0,
      choices: [
        { label: 'Halley (1982 HG1)', mpcID: '1982 HG1', kind: 'asteroid' },
        { label: 'Halley (1P)', mpcID: '1P', kind: 'comet' },
      ],
    });
  });

  it('keeps 12 choices and counts the rest', () => {
    const r = parseHorizonsIndexSearch(HZ_ATLAS);
    expect(r?.kind).toBe('choices');
    if (r?.kind !== 'choices') return;
    expect(r.choices).toHaveLength(12);
    expect(r.more).toBe(2);
    expect(r.choices[0]).toEqual({ label: 'ATLAS (C/2025 A1)', mpcID: 'C/2025 A1', kind: 'comet' });
  });

  it('ignores a normal ephemeris', () => {
    expect(parseHorizonsIndexSearch('$$SOE\n2461164.5 = A.D. 2026-May-04\n$$EOE')).toBeNull();
  });
});

describe('sbdbChoices', () => {
  // Live SBDB HTTP 300 for sstr=Halley.
  const HALLEY = {
    code: '300',
    list: [
      { name: '2688 Halley (1982 HG1)', pdes: '2688' },
      { name: '1P/Halley', pdes: '1P' },
    ],
  };

  it('reads non-periodic comets from their name (live sstr=ATLAS)', () => {
    const atlas = {
      code: '300',
      list: [
        { name: '427P/ATLAS', pdes: '427P' },
        { pdes: '2015 X7', name: 'C/2015 X7 (ATLAS)' },
        { pdes: '2019 AA', name: '2019 AA (ATLAS)' },
      ],
    };
    expect(sbdbChoices(atlas, 'comet').map((c) => c.mpcID)).toEqual(['427P', '2015 X7']);
    expect(sbdbChoices(atlas, 'asteroid').map((c) => c.mpcID)).toEqual(['2019 AA']);
  });

  it('keeps only the requested kind', () => {
    expect(sbdbChoices(HALLEY, 'comet')).toEqual([{ label: '1P/Halley', mpcID: '1P', kind: 'comet' }]);
    expect(sbdbChoices(HALLEY, 'asteroid')).toEqual([
      { label: '2688 Halley (1982 HG1)', mpcID: '2688', kind: 'asteroid' },
    ]);
  });
});
