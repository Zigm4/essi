import type { FoeFamilyPart, FoeField, FoeFieldKey, FoeReport } from './foeDecoder';
import { isBlueprintLoot, lootPool } from './lootPools';

/**
 * A decoded bounty as the Bounty Decoder shows it: the faction headline, the
 * Identity and Combat profile rows and the reward. The share card and message
 * are built from the same rows, so the image always matches the screen.
 */

export const PENDING_DECODE = 'pending decode';
/** Positions 2-6 and the family name only decode once the faction is known. */
export const NEEDS_FACTION = 'needs faction';

export const LOOT_HINT =
  'Loot is RNG: this is the best drop this FOE can give, not a guarantee. You may get something lesser instead, for example scrap in place of a Clothing BP.';
export const BLUEPRINT_HINT =
  'Blueprints are extremely rare: once you own one, you can craft as many as you can afford.';

export function foeField(report: FoeReport, key: FoeFieldKey): FoeField {
  const f = report.fields.find((x) => x.key === key);
  if (f === undefined) throw new Error(`missing field ${key}`);
  return f;
}

export interface FoeHeadline {
  emoji: string;
  /** The faction, or "Unknown faction". */
  name: string;
  /** Three-letter faction code (LYC, OUT…). */
  code?: string;
  known: boolean;
}

export function foeHeadline(report: FoeReport): FoeHeadline {
  const f = foeField(report, 'faction');
  return {
    emoji: f.emoji,
    name: f.known ? f.name : 'Unknown faction',
    ...(f.code !== undefined ? { code: f.code } : {}),
    known: f.known,
  };
}

/** One row of the Identity, Combat profile and Reward cards. */
export interface FoeRow {
  key: FoeFieldKey | 'family';
  label: string;
  /** The decoded value ("Sheriff", "3", "Jedlinman"), or null while it isn't. */
  value: string | null;
  emoji: string;
  /** Short flavour, e.g. a weapon's "Range 6". */
  note?: string;
  code?: string;
  /** The ID digit(s) behind the row (the screen's badge). */
  digits: string;
  /** Shown in place of a missing value. */
  pendingLabel: string;
  /** Raw-value fields (dodge, protection): the value is the digit itself. */
  isValue: boolean;
  /** Family name only: the three fragments, for a partly decoded name. */
  parts?: FoeFamilyPart[];
}

function fieldRow(field: FoeField, pendingLabel: string = PENDING_DECODE): FoeRow {
  return {
    key: field.key,
    label: field.label,
    value: field.known ? field.name : null,
    emoji: field.emoji,
    ...(field.note !== undefined ? { note: field.note } : {}),
    ...(field.code !== undefined ? { code: field.code } : {}),
    digits: field.digit,
    pendingLabel,
    isValue: field.isValue === true,
  };
}

function familyRow(report: FoeReport, factionKnown: boolean): FoeRow {
  return {
    key: 'family',
    label: 'Family name',
    value: factionKnown ? report.familyName : null,
    emoji: '',
    digits: report.familyCode,
    pendingLabel: factionKnown ? PENDING_DECODE : NEEDS_FACTION,
    isValue: false,
    parts: report.familyParts,
  };
}

export interface FoeSections {
  identity: FoeRow[];
  combat: FoeRow[];
  loot: FoeRow;
}

/** The rows in screen order: Identity, Combat profile, then the Reward's loot. */
export function foeSections(report: FoeReport): FoeSections {
  const factionKnown = foeField(report, 'faction').known;
  const dependent = factionKnown ? PENDING_DECODE : NEEDS_FACTION;
  return {
    identity: [fieldRow(foeField(report, 'subfaction'), dependent), familyRow(report, factionKnown)],
    combat: [
      fieldRow(foeField(report, 'rank'), dependent),
      fieldRow(foeField(report, 'dodge')),
      fieldRow(foeField(report, 'weapon'), dependent),
      fieldRow(foeField(report, 'protection')),
    ],
    loot: fieldRow(foeField(report, 'loot')),
  };
}

/** True when a family name is partly decoded (some fragments known, not all). */
export function isPartialFamily(row: FoeRow): boolean {
  return (
    row.key === 'family' &&
    row.value === null &&
    row.pendingLabel === PENDING_DECODE &&
    (row.parts ?? []).some((p) => p.name !== null)
  );
}

/**
 * A row as one line of text: `🐺 Gatling gun · Range 6`, `3`, `Jed?man
 * (partly decoded)`, or its pending label.
 */
export function foeRowText(row: FoeRow): string {
  if (row.value !== null) {
    if (row.isValue) return row.value;
    const emoji = row.emoji === '' ? '' : `${row.emoji} `;
    return `${emoji}${row.value}${row.note === undefined ? '' : ` · ${row.note}`}`;
  }
  if (isPartialFamily(row)) return `${(row.parts ?? []).map((p) => p.name ?? '?').join('')} (partly decoded)`;
  return row.pendingLabel;
}

export interface FoeLootPool {
  /** `Possible Outlaws Clothing BP drops`. */
  label: string;
  items: string[];
}

/** The blueprints this bounty's faction can drop for its loot, or null when not charted. */
export function foeLootPool(report: FoeReport): FoeLootPool | null {
  const loot = foeField(report, 'loot');
  const pool = lootPool(report.factionCode, loot.digit);
  if (pool === undefined) return null;
  return { label: `Possible ${foeField(report, 'faction').name} ${loot.name} drops`, items: pool };
}

export function isBlueprintReward(report: FoeReport): boolean {
  return isBlueprintLoot(foeField(report, 'loot').digit);
}
