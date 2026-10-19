// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ShipCatalogEntry } from './catalog';
import { namesAfterModelSwitch, type NameFields } from './modelSwitch';
import { composedName } from './shipModel';

const MODELS: ShipCatalogEntry[] = [
  { key: 'mmc-shootingstar', displayName: 'MMC Shootingstar', category: 'spacecraft', prefix: 'MMCS', crewSize: null, hullMax: null },
  { key: 'solstice-trigrave', displayName: 'Solstice Trigrave', category: 'spacecraft', prefix: 'SOLT', crewSize: 2, hullMax: 80 },
  { key: 'evil-lawless', displayName: 'EVIL Lawless', category: 'spacecraft', prefix: 'EVIL', crewSize: 0, hullMax: null },
  { key: 'plain-raft', displayName: 'Plain Raft', category: 'watercraft', prefix: null, crewSize: null, hullMax: null },
];
const BY_KEY = new Map(MODELS.map((m) => [m.key, m]));

/** Applies a pick like the editor does and returns the name Save would store. */
function pick(fields: NameFields, newKey: string | null): NameFields & { saved: string } {
  const next = { ...fields, modelKey: newKey, ...namesAfterModelSwitch(fields, newKey, BY_KEY) };
  return { ...next, saved: composedName(next, BY_KEY) };
}

describe('namesAfterModelSwitch', () => {
  it('new ship: keeps the typed number when switching to another prefixed model', () => {
    const typed: NameFields = { modelKey: 'mmc-shootingstar', nameField: '', suffixField: '42' };
    const next = pick(typed, 'solstice-trigrave');
    expect(next.suffixField).toBe('42');
    expect(next.saved).toBe('SOLT-42');
  });

  it('new ship: re-selecting the same model keeps the number', () => {
    const typed: NameFields = { modelKey: 'mmc-shootingstar', nameField: '', suffixField: '42' };
    expect(pick(typed, 'mmc-shootingstar').saved).toBe('MMCS-42');
  });

  it('edit: MMCS-42 becomes SOLT-42, not SOLT-MMCS-42', () => {
    const opened: NameFields = { modelKey: 'mmc-shootingstar', nameField: 'MMCS-42', suffixField: '42' };
    const next = pick(opened, 'solstice-trigrave');
    expect(next.suffixField).toBe('42');
    expect(next.saved).toBe('SOLT-42');
  });

  it('edit: an edited number survives a switch to "No model"', () => {
    const edited: NameFields = { modelKey: 'mmc-shootingstar', nameField: 'MMCS-42', suffixField: '43' };
    const next = pick(edited, null);
    expect(next.nameField).toBe('MMCS-43');
    expect(next.suffixField).toBe('');
    expect(next.saved).toBe('MMCS-43');
  });

  it('a switch to a model without prefix also keeps the call sign as the name', () => {
    const typed: NameFields = { modelKey: 'solstice-trigrave', nameField: '', suffixField: '7' };
    expect(pick(typed, 'plain-raft').saved).toBe('SOLT-7');
  });

  it('a cleared number stays cleared instead of bringing back the old name', () => {
    const cleared: NameFields = { modelKey: 'mmc-shootingstar', nameField: 'MMCS-42', suffixField: '' };
    expect(pick(cleared, 'solstice-trigrave').saved).toBe('');
    expect(pick(cleared, null).saved).toBe('');
  });

  it('free name → prefixed: strips the new prefix or any catalog prefix', () => {
    expect(pick({ modelKey: null, nameField: 'SOLT-42', suffixField: '' }, 'solstice-trigrave').saved).toBe('SOLT-42');
    expect(pick({ modelKey: null, nameField: 'MMCS-42', suffixField: '' }, 'solstice-trigrave').saved).toBe('SOLT-42');
    expect(pick({ modelKey: null, nameField: 'mmcs-42', suffixField: '' }, 'solstice-trigrave').saved).toBe('SOLT-42');
    expect(pick({ modelKey: 'plain-raft', nameField: ' 42 ', suffixField: '' }, 'mmc-shootingstar').saved).toBe('MMCS-42');
    expect(pick({ modelKey: null, nameField: 'Big Bertha', suffixField: '' }, 'mmc-shootingstar').saved).toBe('MMCS-Big Bertha');
  });

  it('round trip prefixed → none → prefixed keeps the number', () => {
    const start: NameFields = { modelKey: 'mmc-shootingstar', nameField: '', suffixField: '42' };
    const none = pick(start, null);
    expect(pick(none, 'solstice-trigrave').saved).toBe('SOLT-42');
  });

  it('free name → no prefix: the name is untouched', () => {
    const free: NameFields = { modelKey: null, nameField: 'Big Bertha', suffixField: '' };
    expect(pick(free, 'plain-raft')).toMatchObject({ nameField: 'Big Bertha', suffixField: '', saved: 'Big Bertha' });
  });
});
