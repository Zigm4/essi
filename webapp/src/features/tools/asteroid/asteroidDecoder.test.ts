// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FormatException } from '../../../core/errors';
import {
  analyze,
  formatAmount,
  isValidId,
  validate,
  type AsteroidTables,
} from './asteroidDecoder';

const tables = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../public/catalog/asteroid_tables.json', import.meta.url)),
    'utf-8',
  ),
) as AsteroidTables;

describe('validate', () => {
  it('flags empty input as failing every rule', () => {
    const rules = validate('');
    expect(rules.every((r) => !r.ok)).toBe(true);
  });

  it('accepts a fully valid id', () => {
    expect(isValidId('195016321')).toBe(true);
  });

  it('rejects wrong length', () => {
    const rules = validate('19501632');
    expect(rules.find((r) => r.id === 'length')?.ok).toBe(false);
    expect(rules.find((r) => r.id === 'digits')?.ok).toBe(true);
  });

  it('rejects non-digits', () => {
    const rules = validate('19501632a');
    expect(rules.find((r) => r.id === 'digits')?.ok).toBe(false);
  });

  it('requires position 1 to be 1', () => {
    expect(validate('295016321').find((r) => r.id === 'type')?.ok).toBe(false);
  });

  it('requires size/wealth/resources to be non-zero', () => {
    expect(validate('105016321').find((r) => r.id === 'size')?.ok).toBe(false);
    expect(validate('195006321').find((r) => r.id === 'wealth')?.ok).toBe(false);
    expect(validate('195016301').find((r) => r.id === 'rss')?.ok).toBe(false);
  });
});

describe('analyze', () => {
  it('throws typed errors with exact copy', () => {
    expect(() => analyze('12345', tables)).toThrow(FormatException);
    expect(() => analyze('12345', tables)).toThrow('Asteroid ID must be exactly 9 digits.');
    expect(() => analyze('12345678x', tables)).toThrow('Asteroid ID must contain digits only.');
  });

  it('decodes 195016321 with resourceValue = 20 and only the infrastructure alert', () => {
    const r = analyze('195016321', tables);
    expect(r.type.name).toBe('Asteroid');
    expect(r.size.name).toBe('Hypermassive');
    expect(r.size.multiplier).toBe(5.0);
    expect(r.structure.name).toBe('Shelter');
    expect(r.structure.risk).toBe(3);
    expect(r.salvage.name).toBe('No salvage');
    expect(r.law.name).toBe('Manned ship');
    expect(r.wealth).toBe(1);
    expect(r.resources.map((x) => x.name)).toEqual(['Helium', 'Oxygen', 'Hydrogen']);
    // (2 + 1 + 1) × 5.0 × 1 = 20
    expect(r.resourceValue).toBe(20);
    expect(r.resourceValueText).toBe('20');
    expect(r.alerts.map((a) => a.level)).toEqual(['info']);
  });

  it('appends alerts in the exact order: info, high, critical, warning', () => {
    // d = 1 9 5 0 5 0 6 6 9 : structure 5, wealth 5, law 0 (pvp), rss 6/6/9
    const r = analyze('195050669', tables);
    expect(r.alerts.map((a) => a.level)).toEqual(['info', 'high', 'critical', 'warning']);
    const critical = r.alerts.find((a) => a.level === 'critical');
    // two resource digits equal 6, wealth is 5
    expect(critical?.message).toBe('Star-Tar deposits detected! Estimated harvest rate: 2-5');
    // (3 + 3 + 5) × 5.0 × 5 = 275
    expect(r.resourceValue).toBe(275);
  });

  it('falls back to the Unknown entry on a lookup miss (no throw)', () => {
    const r = analyze('295016321', tables);
    expect(r.type.name).toBe('Unknown');
    expect(r.type.emoji).toBe('?');
  });

  it('only fires the combat alert for law digit 0', () => {
    // law digit 8 is named PvP but pvp:false - no combat alert
    const r = analyze('195018321', tables);
    expect(r.law.name).toBe('PvP');
    expect(r.alerts.some((a) => a.level === 'warning')).toBe(false);
  });
});

describe('formatAmount', () => {
  it('shows integers without decimals and non-integers with one', () => {
    expect(formatAmount(20)).toBe('20');
    expect(formatAmount(2.5)).toBe('2.5');
    expect(formatAmount(1.0)).toBe('1');
  });
});
