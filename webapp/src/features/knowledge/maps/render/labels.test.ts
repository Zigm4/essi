import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDocument } from '../data/parse';
import { wrapTwoLines } from './labels';

/** Monospace stand-in for the grid's name font: 0.6 em per glyph at 13 px. */
const mono = { measureText: (text: string) => ({ width: text.length * 7.8 }) as TextMetrics };
/** A grid cell's name width (GRID_CELL_WIDTH − 12): 10 glyphs fit, 11 don't. */
const CELL = 84;

function seedNames(id: string): string[] {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/${id}.map.json`);
  const res = validateDocument(JSON.parse(buf.toString('utf-8')), buf.byteLength);
  if (!res.ok) throw new Error(res.message);
  return res.value.zones.map((z) => z.name.trim()).filter((n) => n.length > 0);
}

describe('wrapTwoLines', () => {
  it('keeps a label that fits on one line', () => {
    expect(wrapTwoLines(mono, 'Kings Fort', CELL)).toEqual(['Kings Fort']);
  });

  it('keeps every word when two lines are enough', () => {
    // Before: the second line only got the word that overflowed ("Arms").
    expect(wrapTwoLines(mono, 'Colchis Arms Depot', CELL)).toEqual(['Colchis', 'Arms Depot']);
    expect(wrapTwoLines(mono, 'Mycenae Med Bay', CELL)).toEqual(['Mycenae', 'Med Bay']);
  });

  it('ends the second line with … when the rest does not fit', () => {
    expect(wrapTwoLines(mono, 'Lerna Power Facility', CELL)).toEqual(['Lerna', 'Power Fac…']);
    // No dangling space before the ellipsis.
    expect(wrapTwoLines(mono, 'Rustwind Generator 279', CELL)).toEqual(['Rustwind', 'Generator…']);
  });

  it('cuts a lone word wider than a line, on its own line', () => {
    expect(wrapTwoLines(mono, 'Supercalifragilistic', CELL)).toEqual(['Supercali…']);
    expect(wrapTwoLines(mono, 'Supercalifragilistic Station', CELL)).toEqual(['Supercali…', 'Station']);
  });

  it('a blank label has no lines', () => {
    expect(wrapTwoLines(mono, '  ', CELL)).toEqual([]);
  });

  it('never drops a word without an ellipsis (every seed zone name)', () => {
    const names = [...seedNames('io'), ...seedNames('venus'), ...seedNames('mars')];
    expect(names.length).toBeGreaterThan(2000);
    for (const name of names) {
      const lines = wrapTwoLines(mono, name, CELL);
      expect(lines.length, name).toBeGreaterThan(0);
      expect(lines.length, name).toBeLessThanOrEqual(2);
      for (const line of lines) expect(mono.measureText(line).width, name).toBeLessThanOrEqual(CELL);
      if (lines.join(' ') !== name.split(/\s+/).join(' ')) {
        expect(lines.some((line) => line.endsWith('…')), name).toBe(true);
      }
    }
  });
});
