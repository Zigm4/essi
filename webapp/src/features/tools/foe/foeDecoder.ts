import { FormatException } from '../../../core/errors';

/**
 * Bounty (FOE) ID decoder. A 10-digit id `d1..d10` maps position -> table:
 * 1 faction, 2 subfaction, 3 rank, 4 dodge, 5 weapon, 6 protection, 7 loot,
 * 8-10 family-name code. Pure lookup, fully offline.
 *
 * Three shapes of position:
 *  - FLAT lookup (faction-independent): `faction` and `loot`. Keyed by digit only.
 *  - FACTION-DEPENDENT lookup (2 dimensions): `subfaction`, `rank`, `weapon` and
 *    the three `family` fragments. The same digit means different things per
 *    faction (rank 4 is a LYC "Sheriff" but an MRT "Captain"), so these are
 *    keyed by the faction CODE (LYC, MRT, ...) first, then by digit. When the
 *    faction is unknown these cannot be resolved and fall back to unknown.
 *  - RAW VALUE (no table): `dodge` and `protection` are simply their digit value.
 *
 * Every table lives in `public/catalog/foe_tables.json`, so mappings we do not
 * know yet are filled in later by editing that file - never this module. Any
 * lookup miss falls back to an "unknown" field that still surfaces the raw
 * digit, so a partial catalog stays useful.
 */

export interface FoeTableEntry {
  name?: string;
  emoji?: string;
  /** Faction only: the 3-letter faction code (e.g. QNX, LYC). */
  code?: string;
  /** Optional short flavor line. */
  note?: string;
}

export type FoeFieldKey =
  | 'faction'
  | 'subfaction'
  | 'rank'
  | 'dodge'
  | 'weapon'
  | 'protection'
  | 'loot';

/** Faction-dependent single fields, keyed by faction code then digit. */
export type FactionFieldKey = 'subfaction' | 'rank' | 'weapon';
/** Raw-value fields whose value is simply the digit (no table). */
export type ValueFieldKey = 'dodge' | 'protection';

/** digit -> entry. */
export type FlatTable = Record<string, FoeTableEntry>;
/** faction code -> digit -> entry. */
export type FactionTable = Record<string, Record<string, FoeTableEntry>>;

export interface FoeTables {
  faction: FlatTable;
  loot: FlatTable;
  subfaction: FactionTable;
  rank: FactionTable;
  weapon: FactionTable;
  // dodge and protection have no table: their value is the digit itself.
  /**
   * The family name is NOT a single code: positions 8/9/10 are three separate
   * fragments, each with its own faction-dependent table. The full name is the
   * ordered concatenation of the three resolved fragments (part1 + part2 + part3).
   */
  family1: FactionTable;
  family2: FactionTable;
  family3: FactionTable;
}

/** A decoded position: always carries the raw digit, even when unmapped. */
export interface FoeField {
  key: FoeFieldKey;
  label: string;
  digit: string;
  name: string;
  emoji: string;
  code?: string;
  note?: string;
  /** True when the catalog actually maps this digit (always true for value fields). */
  known: boolean;
  /** True for raw-value fields (dodge, protection): the value is the digit itself. */
  isValue?: boolean;
}

/** One of the three family-name fragments (positions 8, 9, 10). */
export interface FoeFamilyPart {
  digit: string;
  /** Resolved fragment text, or null when unmapped for this faction. */
  name: string | null;
}

export interface FoeReport {
  id: string;
  fields: FoeField[];
  /** Resolved 3-letter faction code (from position 1), or null when unknown. */
  factionCode: string | null;
  /** The raw 3-digit family code (positions 8-10), e.g. "042". */
  familyCode: string;
  /** The three family fragments in order (positions 8, 9, 10). */
  familyParts: FoeFamilyPart[];
  /** Full family name (part1 + part2 + part3) when all three resolve, else null. */
  familyName: string | null;
}

/** Resolve a lookup field (flat or a faction sub-table) against a digit. */
function resolveField(
  spec: { key: FoeFieldKey; label: string },
  table: FlatTable,
  digit: string,
): FoeField {
  const raw = table[digit];
  const known = raw !== undefined && raw.name !== undefined;
  return {
    key: spec.key,
    label: spec.label,
    digit,
    name: known ? raw.name! : 'Unknown',
    emoji: raw?.emoji ?? '',
    known,
    ...(raw?.code !== undefined ? { code: raw.code } : {}),
    ...(raw?.note !== undefined ? { note: raw.note } : {}),
  };
}

/** A raw-value field (dodge, protection): the value is the digit itself. */
function valueField(key: ValueFieldKey, label: string, digit: string): FoeField {
  return { key, label, digit, name: digit, emoji: '', known: true, isValue: true };
}

// --- Validation --------------------------------------------------------------

export interface ValidationRule {
  id: 'digits' | 'length';
  label: string;
  ok: boolean;
}

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Both rules must pass to enable Decode. There are no per-position constraints:
 * faction 0 is a valid ("unknown for now") value, and the same holds for every
 * other position, so any digit is legal at any slot.
 */
export function validate(raw: string): ValidationRule[] {
  const digitsOnly = raw.length > 0 && DIGITS_ONLY.test(raw);
  return [
    { id: 'digits', label: 'Digits only (0-9)', ok: digitsOnly },
    { id: 'length', label: 'Exactly 10 digits', ok: digitsOnly && raw.length === 10 },
  ];
}

export function isValidId(raw: string): boolean {
  return validate(raw).every((r) => r.ok);
}

// --- Analysis ----------------------------------------------------------------

/**
 * Decodes a raw id string. Throws FormatException with the exact user-facing
 * message on a bad length / non-digit input; any lookup miss falls back to an
 * unknown field rather than throwing.
 */
export function analyze(raw: string, tables: FoeTables): FoeReport {
  if (raw.length !== 10) {
    throw new FormatException('Bounty ID must be exactly 10 digits.');
  }
  if (!DIGITS_ONLY.test(raw)) {
    throw new FormatException('Bounty ID must contain digits only.');
  }

  const d = raw.split('');

  // Position 1 (flat) - drives every faction-dependent lookup below.
  const factionField = resolveField({ key: 'faction', label: 'Faction' }, tables.faction, d[0]!);
  const factionCode = factionField.code ?? null;

  // A faction-dependent lookup resolves within the faction's sub-table (or
  // stays unknown when the faction itself is unknown).
  const factionLookup = (key: FactionFieldKey, label: string, index: number): FoeField => {
    const sub = factionCode !== null ? (tables[key][factionCode] ?? {}) : {};
    return resolveField({ key, label }, sub, d[index]!);
  };

  // Fields in canonical position order (positions 1-7).
  const fields: FoeField[] = [
    factionField,
    factionLookup('subfaction', 'Subfaction', 1),
    factionLookup('rank', 'Rank', 2),
    valueField('dodge', 'Dodge', d[3]!),
    factionLookup('weapon', 'Weapon', 4),
    valueField('protection', 'Protection', d[5]!),
    resolveField({ key: 'loot', label: 'Loot' }, tables.loot, d[6]!),
  ];

  // Positions 8-10 (faction-dependent): three separate fragments, concatenated.
  const familyDigits = [d[7]!, d[8]!, d[9]!];
  const familyTables = [tables.family1, tables.family2, tables.family3];
  const familyParts: FoeFamilyPart[] = familyDigits.map((digit, i) => {
    const sub = factionCode !== null ? (familyTables[i]![factionCode] ?? {}) : {};
    return { digit, name: sub[digit]?.name ?? null };
  });
  const familyCode = familyDigits.join('');
  const familyComplete = familyParts.every((p) => p.name !== null);
  const familyName = familyComplete ? familyParts.map((p) => p.name).join('') : null;

  return { id: raw, fields, factionCode, familyCode, familyParts, familyName };
}
