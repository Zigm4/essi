import { FormatException } from '../../../core/errors';

/**
 * Asteroid ID decoder (spec §7). A 9-digit id `d1..d9` maps position→table:
 * 1 type, 2 size, 3 structure, 4 salvage, 5 wealth (raw digit), 6 law,
 * 7/8/9 resources. Pure lookup, fully offline.
 */

export interface AsteroidTableEntry {
  name?: string;
  emoji?: string;
  multiplier?: number;
  risk?: number;
  value?: number;
  pvp?: boolean;
  symbol?: string;
}

export type AsteroidTableName = 'type' | 'size' | 'structure' | 'salvage' | 'law' | 'resource';

export type AsteroidTables = Record<AsteroidTableName, Record<string, AsteroidTableEntry>>;

/** A table entry after defaulting name/emoji - never undefined fields for those. */
export interface ResolvedEntry {
  name: string;
  emoji: string;
  multiplier?: number;
  risk?: number;
  value?: number;
  pvp?: boolean;
  symbol?: string;
}

const UNKNOWN_ENTRY: ResolvedEntry = { name: 'Unknown', emoji: '?' };

function resolve(table: Record<string, AsteroidTableEntry>, digit: string): ResolvedEntry {
  const raw = table[digit];
  if (raw === undefined) return UNKNOWN_ENTRY;
  return {
    name: raw.name ?? 'Unknown',
    emoji: raw.emoji ?? '?',
    ...(raw.multiplier !== undefined ? { multiplier: raw.multiplier } : {}),
    ...(raw.risk !== undefined ? { risk: raw.risk } : {}),
    ...(raw.value !== undefined ? { value: raw.value } : {}),
    ...(raw.pvp !== undefined ? { pvp: raw.pvp } : {}),
    ...(raw.symbol !== undefined ? { symbol: raw.symbol } : {}),
  };
}

// --- Validation --------------------------------------------------------------

export interface ValidationRule {
  id: 'digits' | 'length' | 'type' | 'size' | 'wealth' | 'rss';
  label: string;
  ok: boolean;
}

const DIGITS_ONLY = /^[0-9]+$/;

/** The 6 validation rules (§7.1); all must pass to enable Analyze. */
export function validate(raw: string): ValidationRule[] {
  const digitsOnly = raw.length > 0 && DIGITS_ONLY.test(raw);
  const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
  const nonZeroDigit = (c: string | undefined): boolean => isDigit(c) && c !== '0';
  return [
    { id: 'digits', label: 'Digits only (0-9)', ok: digitsOnly },
    { id: 'length', label: 'Exactly 9 digits', ok: digitsOnly && raw.length === 9 },
    { id: 'type', label: 'Position 1 = 1 (Asteroid)', ok: raw[0] === '1' },
    { id: 'size', label: 'Position 2 (size) is 1-9', ok: nonZeroDigit(raw[1]) },
    { id: 'wealth', label: 'Position 5 (wealth) is 1-9', ok: nonZeroDigit(raw[4]) },
    {
      id: 'rss',
      label: 'Positions 7-9 (resources) are 1-9',
      ok: nonZeroDigit(raw[6]) && nonZeroDigit(raw[7]) && nonZeroDigit(raw[8]),
    },
  ];
}

export function isValidId(raw: string): boolean {
  return validate(raw).every((r) => r.ok);
}

// --- Analysis ----------------------------------------------------------------

export type AlertLevel = 'info' | 'high' | 'critical' | 'warning';

export interface AsteroidAlert {
  level: AlertLevel;
  emoji: string;
  message: string;
}

export interface AsteroidReport {
  id: string;
  type: ResolvedEntry;
  size: ResolvedEntry;
  structure: ResolvedEntry;
  salvage: ResolvedEntry;
  law: ResolvedEntry;
  resources: ResolvedEntry[];
  /** Raw wealth digit d5, 0-9. */
  wealth: number;
  resourceValue: number;
  resourceValueText: string;
  alerts: AsteroidAlert[];
}

/** integer when whole, else one decimal (shared by resource value + ×mult). */
export function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Tint token for an alert level (§7.1). */
export function alertTint(level: AlertLevel): string {
  switch (level) {
    case 'info':
      return '#4FC3FF'; // accentPrimary
    case 'warning':
    case 'high':
      return '#FFB347'; // accentWarn
    case 'critical':
      return '#FF5577'; // accentDanger
  }
}

/**
 * Decodes a raw id string. Throws FormatException with the exact user-facing
 * message on a bad length / non-digit input; any lookup miss falls back to the
 * Unknown entry rather than throwing.
 */
export function analyze(raw: string, tables: AsteroidTables): AsteroidReport {
  if (raw.length !== 9) {
    throw new FormatException('Asteroid ID must be exactly 9 digits.');
  }
  if (!DIGITS_ONLY.test(raw)) {
    throw new FormatException('Asteroid ID must contain digits only.');
  }

  const d = raw.split('');
  const type = resolve(tables.type, d[0]!);
  const size = resolve(tables.size, d[1]!);
  const structure = resolve(tables.structure, d[2]!);
  const salvage = resolve(tables.salvage, d[3]!);
  const wealth = Number.parseInt(d[4]!, 10);
  const law = resolve(tables.law, d[5]!);
  const resourceDigits = [d[6]!, d[7]!, d[8]!];
  const resources = resourceDigits.map((digit) => resolve(tables.resource, digit));

  const resourceSum = resources.reduce((acc, r) => acc + (r.value ?? 0), 0);
  const multiplier = size.multiplier ?? 1.0;
  const resourceValue = resourceSum * multiplier * wealth;

  const alerts: AsteroidAlert[] = [];
  const structureDigit = Number.parseInt(d[2]!, 10);
  if (structureDigit >= 5) {
    alerts.push({ level: 'info', emoji: '🏗', message: 'This asteroid has significant infrastructure.' });
  }
  if (resourceDigits.some((digit) => digit === '9')) {
    alerts.push({ level: 'high', emoji: '💎', message: 'Rare gas deposits detected!' });
  }
  const lawDigit = Number.parseInt(d[5]!, 10);
  const starTarCount = resourceDigits.filter((digit) => digit === '6').length;
  if (lawDigit === 0 && starTarCount > 0) {
    alerts.push({
      level: 'critical',
      emoji: '⚠',
      message: `Star-Tar deposits detected! Estimated harvest rate: ${starTarCount}-${wealth}`,
    });
  }
  if (law.pvp === true) {
    alerts.push({ level: 'warning', emoji: '⚔', message: 'Combat enabled zone, proceed with caution.' });
  }

  return {
    id: raw,
    type,
    size,
    structure,
    salvage,
    law,
    resources,
    wealth,
    resourceValue,
    resourceValueText: formatAmount(resourceValue),
    alerts,
  };
}
