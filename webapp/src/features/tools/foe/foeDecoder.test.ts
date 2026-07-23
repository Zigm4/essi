// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FormatException } from '../../../core/errors';
import { analyze, isValidId, validate, type FoeTables } from './foeDecoder';

const tables = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../public/catalog/foe_tables.json', import.meta.url)),
    'utf-8',
  ),
) as FoeTables;

const field = (id: string, key: string) => {
  const f = analyze(id, tables).fields.find((x) => x.key === key);
  if (f === undefined) throw new Error(`missing field ${key}`);
  return f;
};

describe('validate', () => {
  it('flags empty input as failing every rule', () => {
    expect(validate('').every((r) => !r.ok)).toBe(true);
  });

  it('accepts any 10-digit id (no per-position constraints)', () => {
    expect(isValidId('3241501042')).toBe(true);
    expect(isValidId('0000000000')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(validate('324150104').find((r) => r.id === 'length')?.ok).toBe(false);
    expect(validate('324150104').find((r) => r.id === 'digits')?.ok).toBe(true);
    expect(validate('32415010422').find((r) => r.id === 'length')?.ok).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(validate('324150104a').find((r) => r.id === 'digits')?.ok).toBe(false);
  });
});

describe('analyze - flat fields (faction, loot)', () => {
  it('throws typed errors with exact copy', () => {
    expect(() => analyze('12345', tables)).toThrow(FormatException);
    expect(() => analyze('12345', tables)).toThrow('Bounty ID must be exactly 10 digits.');
    expect(() => analyze('123456789x', tables)).toThrow('Bounty ID must contain digits only.');
  });

  it('resolves faction with its code and exposes factionCode on the report', () => {
    const faction = field('3241501042', 'faction');
    expect(faction.name).toBe('Lycanox');
    expect(faction.code).toBe('LYC');
    expect(analyze('3241501042', tables).factionCode).toBe('LYC');
    expect(field('7000000005', 'faction').code).toBe('AEA');
  });

  it('resolves loot regardless of faction', () => {
    expect(field('3241501042', 'loot').name).toBe('100c');
    expect(field('0000000000', 'loot').name).toBe('Blood');
  });

  it('unknown faction digit resolves to Unknown with null factionCode', () => {
    const r = analyze('0000000000', tables);
    expect(r.factionCode).toBeNull();
    expect(r.fields[0]?.name).toBe('Unknown');
    expect(r.fields[0]?.known).toBe(false);
  });
});

describe('analyze - faction-dependent fields (2D)', () => {
  it('reads rank differently per faction', () => {
    expect(field('3040000000', 'rank').name).toBe('Sheriff'); // LYC rank 4
    expect(field('4040000000', 'rank').name).toBe('Captain'); // MRT rank 4
    expect(field('7070000000', 'rank').name).toBe('Commander'); // AEA rank 7
    expect(field('7000000000', 'rank').name).toBe('Scout'); // AEA rank 0
    expect(field('7050000000', 'rank').name).toBe('HARVESTER'); // AEA rank 5
    expect(field('3080000000', 'rank').name).toBe('General'); // LYC rank 8
    expect(field('6040000000', 'rank').name).toBe('Gang leader'); // OUT rank 4
    expect(field('6080000000', 'rank').name).toBe('King'); // OUT rank 8
  });

  it('carries a weapon note (range) when present', () => {
    const weapon = field('3000300000', 'weapon'); // LYC weapon 3
    expect(weapon.name).toBe('Old revolver');
    expect(weapon.note).toBe('Range 3');

    const acid = field('7000500000', 'weapon'); // AEA weapon 5
    expect(acid.name).toBe('Acid bomb');
    expect(acid.note).toBe('Range 5');
  });

  it('reads weapon differently per faction', () => {
    expect(field('6000200000', 'weapon').name).toBe('IRON HALBERD'); // OUT weapon 2
    expect(field('6000300000', 'weapon').name).toBe('SAND GUN'); // OUT weapon 3
    expect(field('7000300000', 'weapon').name).toBe('Plasnet'); // AEA weapon 3
  });

  it('maps weapon 0 to unarmed for every faction', () => {
    expect(field('1000000000', 'weapon').name).toBe('unarmed'); // QNX weapon 0
    expect(field('3000000000', 'weapon').name).toBe('unarmed'); // LYC weapon 0
    expect(field('7000000000', 'weapon').name).toBe('unarmed'); // AEA weapon 0
  });

  it('treats dodge and protection as raw values (equal to their digit)', () => {
    const r = analyze('3005060000', tables); // dodge=5 (idx3), protection=6 (idx5)
    const dodge = r.fields.find((f) => f.key === 'dodge')!;
    const protection = r.fields.find((f) => f.key === 'protection')!;
    expect(dodge.isValue).toBe(true);
    expect(dodge.name).toBe('5');
    expect(dodge.known).toBe(true);
    expect(protection.isValue).toBe(true);
    expect(protection.name).toBe('6');
  });

  it('resolves dodge and protection even when the faction is unknown', () => {
    const r = analyze('0005060000', tables); // faction 0
    expect(r.fields.find((f) => f.key === 'dodge')!.name).toBe('5');
    expect(r.fields.find((f) => f.key === 'protection')!.name).toBe('6');
  });

  it('cannot resolve dependent fields when the faction is unknown', () => {
    const rank = field('0040000000', 'rank'); // faction 0, rank 4
    expect(rank.name).toBe('Unknown');
    expect(rank.known).toBe(false);
    expect(rank.digit).toBe('4'); // raw digit still surfaced
  });

  it('falls back to unknown for an unmapped digit but keeps the raw digit', () => {
    const sub = field('3241501042', 'subfaction');
    expect(sub.name).toBe('Unknown');
    expect(sub.known).toBe(false);
    expect(sub.digit).toBe('2');
  });
});

describe('analyze - family name (three concatenated fragments, positions 8-10)', () => {
  it('assembles the 3-digit family code', () => {
    expect(analyze('3000000016', tables).familyCode).toBe('016');
    expect(analyze('0000000000', tables).familyCode).toBe('000');
  });

  it('concatenates the three fragments per faction', () => {
    expect(analyze('3000000016', tables).familyName).toBe('Zebsonman'); // LYC 0/1/6
    expect(analyze('7000000254', tables).familyName).toBe('Algaebit0101PB'); // AEA 2/5/4
    expect(analyze('4000000870', tables).familyName).toBe('Yagtonschei'); // MRT 8/7/0
    expect(analyze('6000000223', tables).familyName).toBe('Spiock'); // OUT 2/2/3
  });

  it('matches real sighting names end-to-end (from foe_sightings.json)', () => {
    expect(analyze('6022111684', tables).familyName).toBe('Fanperft'); // OUT
    expect(analyze('6011214852', tables).familyName).toBe('Vileby'); // OUT
    expect(analyze('6236111033', tables).familyName).toBe('Boneck'); // OUT
    expect(analyze('6138111057', tables).familyName).toBe('Bonleth'); // OUT (Bon+le+th)
    expect(analyze('6016210558', tables).familyName).toBe('Knuleng'); // OUT (Knu+le+ng)
    expect(analyze('6139311468', tables).familyName).toBe('Gateyng'); // OUT (Gat+ey+ng)
    expect(analyze('7353352440', tables).familyName).toBe('BIOMIMIC0100KB'); // AEA

    const s = analyze('6022111684', tables);
    expect(s.fields.find((f) => f.key === 'rank')?.name).toBe('Outlaw');
    expect(s.fields.find((f) => f.key === 'weapon')?.name).toBe('DUST THROWER');
  });

  it('returns null full name when any fragment is unmapped, keeping known parts', () => {
    const r = analyze('3000000099', tables); // LYC 0(Zeb)/9(?)/9(?)
    expect(r.familyName).toBeNull();
    expect(r.familyParts.map((p) => p.name)).toEqual(['Zeb', null, null]);
    expect(r.familyParts.map((p) => p.digit)).toEqual(['0', '9', '9']);
  });

  it('cannot resolve any fragment when the faction is unknown', () => {
    const r = analyze('0000000016', tables); // faction 0
    expect(r.familyName).toBeNull();
    expect(r.familyParts.every((p) => p.name === null)).toBe(true);
  });
});

describe('analyze - field order', () => {
  it('returns the 7 single-digit fields in canonical order', () => {
    const r = analyze('3241501042', tables);
    expect(r.fields.map((f) => f.key)).toEqual([
      'faction',
      'subfaction',
      'rank',
      'dodge',
      'weapon',
      'protection',
      'loot',
    ]);
  });
});
