import { describe, expect, it } from 'vitest';
import { blockHeight, measureCard, wrapLines } from './shareCard';

/** 1 px per character: easy widths. */
const ctx = { measureText: (t: string) => ({ width: t.length }) as TextMetrics };

describe('wrapLines', () => {
  it('wraps on words', () => {
    expect(wrapLines(ctx, 'one two three four', 9, 5)).toEqual(['one two', 'three', 'four']);
  });

  it('ends the last line with … when text is left over', () => {
    const lines = wrapLines(ctx, 'one two three four five', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    expect(lines[1]!.length).toBeLessThanOrEqual(9);
  });

  it('cuts a word longer than a line', () => {
    expect(wrapLines(ctx, 'supercalifragilistic', 8, 2)).toEqual(['superca…']);
  });
});

describe('paragraph height', () => {
  it('uses the laid-out lines, else an estimate', () => {
    expect(blockHeight({ kind: 'paragraph', text: 'x', lines: ['a', 'b', 'c'] })).toBe(8 + 3 * 17);
    expect(blockHeight({ kind: 'paragraph', text: 'x'.repeat(520), maxLines: 4 })).toBe(8 + 4 * 17);
    expect(measureCard({ title: 't', blocks: [{ kind: 'paragraph', text: 'x', lines: ['a'] }], footer: 'f' })).toBeGreaterThan(25);
  });
});
