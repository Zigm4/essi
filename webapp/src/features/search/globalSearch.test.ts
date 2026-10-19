import { describe, expect, it } from 'vitest';
import {
  federateSearchResults,
  runSearchSources,
  seeAllLink,
  snippet,
  targetLocation,
  totalHitCount,
  type GlobalSearchHit,
  type SearchSourceRunners,
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

describe('targetLocation', () => {
  it('a route hit opens its own location', () => {
    expect(targetLocation({ kind: 'route', location: '/knowledge/maps/mars?zone=z1' })).toBe(
      '/knowledge/maps/mars?zone=z1',
    );
  });

  it('a job opens the Jobs tool searching #<id>', () => {
    expect(targetLocation({ kind: 'job', jobId: '35511202' })).toBe('/tools/jobs?q=%2335511202');
  });

  it('a wallet hit opens Wallet Lookup on its query', () => {
    expect(targetLocation({ kind: 'wallet', query: '! Cruzified' })).toBe('/tools/wallet?q=!%20Cruzified');
  });
});

describe('seeAllLink', () => {
  it('jobs and wallets link to their tool with the same query', () => {
    expect(seeAllLink('job', 'prq rocks')).toEqual({ location: '/tools/jobs?q=prq%20rocks', label: 'Jobs' });
    expect(seeAllLink('wallet', 'wam')).toEqual({ location: '/tools/wallet?q=wam', label: 'Wallet Lookup' });
  });

  it('other sources have no such list', () => {
    expect(seeAllLink('mapZone', 'x')).toBeNull();
    expect(seeAllLink('capture', 'x')).toBeNull();
  });
});

describe('runSearchSources', () => {
  const none = async (): Promise<GlobalSearchHit[]> => [];
  const idle: SearchSourceRunners = {
    mapZone: none,
    kbArticle: none,
    job: none,
    wallet: none,
    capture: none,
    mapPin: none,
  };

  it('each source fails on its own - the others are still listed', async () => {
    const result = await runSearchSources('  recall ', {
      ...idle,
      kbArticle: () => Promise.reject(new Error('manifest -> HTTP 500')),
      job: () => {
        throw new Error('sync throw');
      },
      capture: async (q) => [hit('capture', `note about ${q}`)],
      mapPin: async () => hits('mapPin', 2),
    });
    expect(result.query).toBe('recall');
    expect(result.groups.map((g) => g.source)).toEqual(['capture', 'mapPin']);
    expect(result.groups[0]!.visible[0]!.title).toBe('note about recall');
    expect(result.failed.map((f) => f.source)).toEqual(['kbArticle', 'job']);
    expect((result.failed[0]!.error as Error).message).toBe('manifest -> HTTP 500');
  });

  it('reports every source when all fail', async () => {
    const fail = () => Promise.reject(new Error('offline'));
    const result = await runSearchSources('x', {
      mapZone: fail,
      kbArticle: fail,
      job: fail,
      wallet: fail,
      capture: fail,
      mapPin: fail,
    });
    expect(result.groups).toEqual([]);
    expect(result.failed).toHaveLength(6);
  });

  it('starts every source synchronously, in display order', () => {
    const started: string[] = [];
    const track = (source: SearchSourceValue) => async () => {
      started.push(source);
      return [];
    };
    void runSearchSources('x', {
      mapZone: track('mapZone'),
      kbArticle: track('kbArticle'),
      job: track('job'),
      wallet: track('wallet'),
      capture: track('capture'),
      mapPin: track('mapPin'),
    });
    expect(started).toEqual(['mapZone', 'kbArticle', 'job', 'wallet', 'capture', 'mapPin']);
  });

  it('a blank query runs no source', async () => {
    const result = await runSearchSources('   ', {
      ...idle,
      capture: () => Promise.reject(new Error('should not run')),
    });
    expect(result).toEqual({ query: '', groups: [], failed: [] });
  });
});
