import { describe, expect, it } from 'vitest';
import { blockHeight, keepParenthesesTogether, measureCard, parseInlineMarkdown, wrapLines, wrapRich } from './shareCard';

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

describe('parseInlineMarkdown', () => {
  it('reads bold and code like the app', () => {
    expect(parseInlineMarkdown('**PRQ**: Compose a jingle.')).toEqual([
      [
        { text: 'PRQ', style: 'bold' },
        { text: ': Compose a jingle.', style: 'plain' },
      ],
    ]);
    expect(parseInlineMarkdown('use ``!work`` or `!job`')).toEqual([
      [
        { text: 'use ', style: 'plain' },
        { text: '!work', style: 'code' },
        { text: ' or ', style: 'plain' },
        { text: '!job', style: 'code' },
      ],
    ]);
  });

  it('keeps paragraphs apart', () => {
    expect(parseInlineMarkdown('one\n\ntwo')).toHaveLength(2);
  });
});

describe('wrapRich', () => {
  const measure = (t: string) => t.length;

  it('keeps "**PRQ**:" together and wraps on spaces', () => {
    const lines = wrapRich(parseInlineMarkdown('**PRQ**: one two three'), 9, 5, measure);
    expect(lines).toEqual([
      [
        { text: 'PRQ', style: 'bold' },
        { text: ': one', style: 'plain' },
      ],
      [{ text: 'two three', style: 'plain' }],
    ]);
  });

  it('never breaks at a no-break space', () => {
    const lines = wrapRich(parseInlineMarkdown('aa bb · cc dd'), 8, 5, measure);
    expect(lines.map((l) => l.map((r) => r.text).join(''))).toEqual(['aa bb ·', 'cc dd']);
  });

  it('ends a cut text with …', () => {
    const lines = wrapRich(parseInlineMarkdown('aa bb cc dd ee ff'), 5, 2, measure);
    expect(lines).toHaveLength(2);
    const last = lines[1]!.map((r) => r.text).join('');
    expect(last.endsWith('…')).toBe(true);
    expect(last.length).toBeLessThanOrEqual(5);
  });
});

describe('panel height', () => {
  it('grows with its content', () => {
    const small = blockHeight({ kind: 'panel', items: [{ kind: 'facts', rows: [{ label: 'a', value: 'b' }] }] });
    const big = blockHeight({
      kind: 'panel',
      items: [{ kind: 'facts', rows: Array.from({ length: 6 }, () => ({ label: 'a', value: 'b' })) }],
    });
    expect(big).toBeGreaterThan(small);
  });

  it('keeps its height when tinted like an alert box', () => {
    const items = [{ kind: 'rich' as const, text: '🏗 This asteroid has significant infrastructure.' }];
    expect(blockHeight({ kind: 'panel', items, tint: '#4FC3FF' })).toBe(blockHeight({ kind: 'panel', items }));
  });
});

describe('hero', () => {
  it('keeps its height with a depth circle', () => {
    const hero = { kind: 'hero' as const, emoji: '🎣', title: 'Zone', caption: 'Zone 49' };
    expect(blockHeight({ ...hero, dot: '#E07AA8' })).toBe(blockHeight(hero));
  });
});

describe('keepParenthesesTogether', () => {
  it('breaks a place before its coordinates, never inside them', () => {
    const value = keepParenthesesTogether('Ratropia · Northshire (355 · z35)');
    expect(wrapLines(ctx, value, 24, 2)).toEqual(['Ratropia · Northshire', '(355\u00A0·\u00A0z35)']);
  });
});
