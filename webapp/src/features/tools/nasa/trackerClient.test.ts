import { describe, expect, it, vi } from 'vitest';
import type { TrackedObject } from './catalog';
import { TrackerMpcLookupError } from './errors';
import {
  buildCommandID,
  resolveMPC,
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
  it('tier 0 — prefilled mpcID wins outright', async () => {
    expect(
      await resolveMPC({ name: 'anything', kind: 'asteroid', mpcID: '99942' }, CATALOG, neverCalled),
    ).toBe('99942');
  });

  it('tier 1 — exact catalog match (case-insensitive) → identifier', async () => {
    expect(await resolveMPC({ name: 'ceres', kind: 'asteroid' }, CATALOG, neverCalled)).toBe('1');
  });

  it('throws when the name is empty after cleaning', async () => {
    await expect(resolveMPC({ name: '()', kind: 'asteroid' }, CATALOG, neverCalled)).rejects.toBeInstanceOf(
      TrackerMpcLookupError,
    );
  });

  it('tier 2 — digits-only asteroid is used as-is, no network', async () => {
    expect(await resolveMPC({ name: '433', kind: 'asteroid' }, CATALOG, neverCalled)).toBe('433');
  });

  it('tier 3 — SBDB lookup returns a pdes', async () => {
    const lookup = vi.fn<SbdbLookupFn>().mockResolvedValue('1P');
    expect(await resolveMPC({ name: 'Halley', kind: 'comet' }, CATALOG, lookup)).toBe('1P');
    expect(lookup).toHaveBeenCalledWith('Halley');
  });

  it('tier 3 — retries with the trailing parenthetical stripped', async () => {
    const lookup = vi
      .fn<SbdbLookupFn>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('2024 G3');
    // Use a comet name NOT in the catalog so tier 1 does not short-circuit.
    const got = await resolveMPC({ name: 'C/2099 Z9 (TEST)', kind: 'comet' }, CATALOG, lookup);
    expect(got).toBe('2024 G3');
    expect(lookup).toHaveBeenNthCalledWith(1, 'C/2099 Z9 (TEST)');
    expect(lookup).toHaveBeenNthCalledWith(2, 'C/2099 Z9');
  });

  it('tier 4 — passthrough when the cleaned name has a digit and a letter', async () => {
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
  it('strips C//P/ prefix and trailing parenthetical for comets', () => {
    expect(buildCommandID('C/2024 G3 (ATLAS)', 'comet')).toBe('2024 G3');
    expect(buildCommandID('P/2003 CP7', 'comet')).toBe('2003 CP7');
  });

  it('appends a semicolon to numbered asteroids (Ceres, not Mercury barycenter)', () => {
    expect(buildCommandID('1', 'asteroid')).toBe('1;');
    expect(buildCommandID('99942', 'asteroid')).toBe('99942;');
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
