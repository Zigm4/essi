import { describe, expect, it } from 'vitest';
import {
  federateSearchResults,
  snippet,
  totalHitCount,
  type GlobalSearchHit,
  type SearchSourceValue,
} from './globalSearch';

function hit(source: SearchSourceValue, title: string): GlobalSearchHit {
  return {
    source,
    title,
    subtitle: '',
    icon: 'menu_book',
    target: { kind: 'route', location: `/x/${title}` },
  };
}

function hits(source: SearchSourceValue, n: number): GlobalSearchHit[] {
  return Array.from({ length: n }, (_, i) => hit(source, `${source}-${i}`));
}

describe('snippet', () => {
  it('collapses whitespace and trims', () => {
    expect(snippet('  a\n\n b   c  ')).toBe('a b c');
  });

  it('truncates with an ellipsis past max', () => {
    expect(snippet('abcdef', 4)).toBe('abcd…');
  });

  it('does not truncate at exactly max', () => {
    expect(snippet('abcd', 4)).toBe('abcd');
  });
});

describe('federateSearchResults', () => {
  it('keeps the fixed source order and skips empty groups', () => {
    const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
      ['capture', hits('capture', 2)],
      ['kbArticle', hits('kbArticle', 1)],
    ]);
    const groups = federateSearchResults(bySource);
    // kbArticle (#2) comes before capture (#5) regardless of insertion order.
    expect(groups.map((g) => g.source)).toEqual(['kbArticle', 'capture']);
  });

  it('caps each group at 5 and reports hidden count', () => {
    const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
      ['kbArticle', hits('kbArticle', 8)],
    ]);
    const [group] = federateSearchResults(bySource);
    expect(group.total).toBe(8);
    expect(group.visible).toHaveLength(5);
    expect(group.hiddenCount).toBe(3);
    expect(group.hasMore).toBe(true);
  });

  it('does not flag hasMore at exactly the cap', () => {
    const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
      ['kbArticle', hits('kbArticle', 5)],
    ]);
    const [group] = federateSearchResults(bySource);
    expect(group.hiddenCount).toBe(0);
    expect(group.hasMore).toBe(false);
  });

  it('a non-positive cap disables capping', () => {
    const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
      ['kbArticle', hits('kbArticle', 8)],
    ]);
    const [group] = federateSearchResults(bySource, 0);
    expect(group.visible).toHaveLength(8);
    expect(group.hasMore).toBe(false);
  });

  it('totalHitCount sums pre-cap totals', () => {
    const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
      ['kbArticle', hits('kbArticle', 8)],
      ['capture', hits('capture', 3)],
    ]);
    expect(totalHitCount(federateSearchResults(bySource))).toBe(11);
  });
});
