/**
 * Shared JPL Horizons ephemeris text parser (tools-live spec §4.7).
 *
 * The Horizons response - in `format=text` (System Scan) or wrapped in the
 * JSON envelope's `result` string (Tracker) - is one plain-text document. The
 * ephemeris rows live between the `$$SOE` and `$$EOE` markers. This parser is
 * deliberately naive: walk the lines, grab the date when a line contains
 * `A.D.`, grab the vector when a line starts with `X =`, repeat.
 */

/** One raw heliocentric sample: X/Y/Z in kilometres, timestamp interpreted UTC. */
export interface RawPosition {
  date: Date;
  x: number;
  y: number;
  z: number;
}

/**
 * Raised when a Horizons payload lacks the `$$SOE` marker - i.e. it is not an
 * ephemeris at all (e.g. an "API SERVER BUSY" rate-limit notice). Carries a
 * collapsed 200-char preview for the user-facing message.
 */
export class HorizonsFormatError extends Error {
  readonly preview: string;

  constructor(preview: string) {
    super(`Horizons returned a non-ephemeris payload: ${preview}`);
    this.name = 'HorizonsFormatError';
    this.preview = preview;
  }
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * `yyyy-MMM-dd HH:mm:ss.SSSS` where MMM is an English month abbreviation.
 * Fractional seconds are optional. Locale-independent (matches the mobile
 * app's forced `en_US_POSIX`). Returns null on any malformation.
 */
const DATE_RE = /^(\d{4})-([A-Za-z]{3})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

export function parseHorizonsDate(raw: string): Date | null {
  const m = DATE_RE.exec(raw.trim());
  if (m === null) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (month === undefined) return null;
  const year = Number.parseInt(m[1]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  const hour = Number.parseInt(m[4]!, 10);
  const minute = Number.parseInt(m[5]!, 10);
  const second = Number.parseInt(m[6]!, 10);
  const frac = m[7];
  const ms = frac === undefined ? 0 : Math.round(Number.parseFloat(`0.${frac}`) * 1000);
  const t = Date.UTC(year, month, day, hour, minute, second, ms);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Vector line, anchored at line start so the `VX= VY= VZ=` velocity line never
 * matches. Tolerant of spacing and scientific notation.
 */
const VECTOR_RE =
  /^X\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)\s+Y\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)\s+Z\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)/;

/** Collapse whitespace runs to single spaces, trim, first 200 chars. */
export function collapsePreview(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * Parse every position between `$$SOE` and `$$EOE`.
 * @throws HorizonsFormatError when `$$SOE` is absent.
 */
export function parseHorizonsEphemeris(text: string): RawPosition[] {
  const soe = text.indexOf('$$SOE');
  if (soe === -1) {
    throw new HorizonsFormatError(collapsePreview(text));
  }
  const bodyStart = soe + '$$SOE'.length;
  const eoe = text.indexOf('$$EOE', bodyStart);
  const body = eoe === -1 ? text.slice(bodyStart) : text.slice(bodyStart, eoe);

  const positions: RawPosition[] = [];
  let pendingDate: Date | null = null;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.includes('A.D.')) {
      // Text after the last `A.D.`, before the first `TDB`.
      const afterAd = line.slice(line.lastIndexOf('A.D.') + 'A.D.'.length);
      const tdb = afterAd.indexOf('TDB');
      const dateStr = (tdb === -1 ? afterAd : afterAd.slice(0, tdb)).trim();
      pendingDate = parseHorizonsDate(dateStr);
      continue;
    }
    const vm = VECTOR_RE.exec(line);
    if (vm !== null && pendingDate !== null) {
      positions.push({
        date: pendingDate,
        x: Number.parseFloat(vm[1]!),
        y: Number.parseFloat(vm[2]!),
        z: Number.parseFloat(vm[3]!),
      });
      pendingDate = null;
    }
  }
  return positions;
}
