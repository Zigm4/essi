import { alertTint, formatAmount, type AsteroidReport } from './asteroidDecoder';

/**
 * An asteroid report as the Analyzer shows it: the alerts, the wealth, the
 * primary characteristics and the resources. The share card and message are
 * built from the same rows, so the image always matches the screen.
 */

/** The highest wealth digit (the screen's row of 9 coins). */
export const WEALTH_MAX = 9;

export interface AlertRow {
  emoji: string;
  message: string;
  /** Box colour (#RRGGBB) for the alert's level. */
  tint: string;
}

export function alertRows(report: AsteroidReport): AlertRow[] {
  return report.alerts.map((a) => ({ emoji: a.emoji, message: a.message, tint: alertTint(a.level) }));
}

/** `2/9`. */
export function wealthText(report: AsteroidReport): string {
  return `${report.wealth}/${WEALTH_MAX}`;
}

/** One "Primary characteristics" line: `Size · 🟦 Huge · ×2.5`. */
export interface CharacteristicRow {
  label: string;
  emoji: string;
  name: string;
  suffix?: string;
}

export function characteristicRows(report: AsteroidReport): CharacteristicRow[] {
  return [
    { label: 'Type', emoji: report.type.emoji, name: report.type.name },
    {
      label: 'Size',
      emoji: report.size.emoji,
      name: report.size.name,
      suffix: `×${formatAmount(report.size.multiplier ?? 1)}`,
    },
    {
      label: 'Structure',
      emoji: report.structure.emoji,
      name: report.structure.name,
      suffix: `risk ${report.structure.risk ?? 0}`,
    },
    {
      label: 'Salvage',
      emoji: report.salvage.emoji,
      name: report.salvage.name,
      suffix: `value ${report.salvage.value ?? 0}`,
    },
    { label: 'Law', emoji: report.law.emoji, name: report.law.name },
  ];
}

/** `🟦 Huge · ×2.5` - a characteristic as one line of text. */
export function characteristicText(row: CharacteristicRow): string {
  return `${row.emoji} ${row.name}${row.suffix === undefined ? '' : ` · ${row.suffix}`}`;
}

/** One resource line: `💧 Hydrogen (H2) · 1 pts`. */
export interface ResourceRow {
  emoji: string;
  name: string;
  symbol?: string;
  points: string;
}

export function resourceRows(report: AsteroidReport): ResourceRow[] {
  return report.resources.map((r) => ({
    emoji: r.emoji,
    name: r.name,
    ...(r.symbol !== undefined ? { symbol: r.symbol } : {}),
    points: `${r.value ?? 0} pts`,
  }));
}
