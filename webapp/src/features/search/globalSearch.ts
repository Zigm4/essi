/**
 * Federated global search (knowledge spec §11-12). A single query is fanned out
 * to 6 sources in a fixed order; each group is capped at 5 visible rows.
 *
 * This module is the pure core - sources, hits, targets, federation and the
 * fan-out itself. The six source adapters (KB index, jobs and wallets catalogs,
 * installed map zones, notes/links and map pins) live in searchSources.ts.
 */

// --- Sources -----------------------------------------------------------------

export const SearchSource = {
  mapZone: 'mapZone',
  kbArticle: 'kbArticle',
  job: 'job',
  wallet: 'wallet',
  capture: 'capture',
  mapPin: 'mapPin',
} as const;

export type SearchSourceValue = (typeof SearchSource)[keyof typeof SearchSource];

/** Fixed display order (§12.2, enum order). */
export const SEARCH_SOURCE_ORDER: readonly SearchSourceValue[] = [
  SearchSource.mapZone,
  SearchSource.kbArticle,
  SearchSource.job,
  SearchSource.wallet,
  SearchSource.capture,
  SearchSource.mapPin,
];

export const SEARCH_SOURCE_TITLES: Record<SearchSourceValue, string> = {
  mapZone: 'Map zones',
  kbArticle: 'Knowledge base',
  job: 'Jobs',
  wallet: 'Wallets',
  capture: 'Notes & links',
  mapPin: 'My map notes',
};

/** Per-hit icon key (variants within a source, e.g. note vs link) → §12.2. */
export type SearchHitIcon = 'map' | 'menu_book' | 'work' | 'person' | 'wallet' | 'note' | 'link' | 'pin';

export type GlobalSearchTarget =
  | { kind: 'route'; location: string }
  | { kind: 'wallet'; query: string }
  | { kind: 'job'; jobId: string };

export interface GlobalSearchHit {
  source: SearchSourceValue;
  title: string;
  subtitle: string;
  icon: SearchHitIcon;
  target: GlobalSearchTarget;
}

/**
 * Where a hit leads. A job opens the Jobs tool searching `#<id>` with that
 * job's sheet open (`q` and `job` are read on arrival), a wallet hit opens
 * Wallet Lookup on its own query.
 */
export function targetLocation(target: GlobalSearchTarget): string {
  switch (target.kind) {
    case 'route':
      return target.location;
    case 'wallet':
      return `/tools/wallet?q=${encodeURIComponent(target.query)}`;
    case 'job':
      // The list filtered to it, and its sheet open even if a Starred / progress filter hides it.
      return `/tools/jobs?q=${encodeURIComponent(`#${target.jobId}`)}&job=${encodeURIComponent(target.jobId)}`;
  }
}

/** The tool that lists every match of a source for the same query, or null (no such list). */
export function seeAllLink(
  source: SearchSourceValue,
  query: string,
): { location: string; label: string } | null {
  const q = encodeURIComponent(query);
  switch (source) {
    case SearchSource.job:
      return { location: `/tools/jobs?q=${q}`, label: 'Jobs' };
    case SearchSource.wallet:
      return { location: `/tools/wallet?q=${q}`, label: 'Wallet Lookup' };
    default:
      return null;
  }
}

// --- Federation (pure) -------------------------------------------------------

export const K_SEARCH_GROUP_CAP = 5;

export interface SearchGroup {
  source: SearchSourceValue;
  title: string;
  /** Pre-cap total. */
  total: number;
  visible: GlobalSearchHit[];
  hiddenCount: number;
  hasMore: boolean;
}

/**
 * `federateSearchResults` (§12.3): iterate sources in the fixed order, skip
 * empty lists, cap each group's visible rows (preserving source ordering),
 * keep the pre-cap total. A non-positive cap disables capping.
 */
export function federateSearchResults(
  bySource: ReadonlyMap<SearchSourceValue, GlobalSearchHit[]>,
  cap: number = K_SEARCH_GROUP_CAP,
): SearchGroup[] {
  const groups: SearchGroup[] = [];
  for (const source of SEARCH_SOURCE_ORDER) {
    const hits = bySource.get(source) ?? [];
    if (hits.length === 0) continue;
    const visible = cap > 0 ? hits.slice(0, cap) : hits.slice();
    const hiddenCount = Math.max(0, hits.length - visible.length);
    groups.push({
      source,
      title: SEARCH_SOURCE_TITLES[source],
      total: hits.length,
      visible,
      hiddenCount,
      hasMore: hiddenCount > 0,
    });
  }
  return groups;
}

/** Sum of pre-cap totals - drives the "No matches" empty state (§12.3). */
export function totalHitCount(groups: readonly SearchGroup[]): number {
  return groups.reduce((sum, group) => sum + group.total, 0);
}

/** `snippet(text, max=80)` helper (§12.4). */
export function snippet(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`;
}

// --- Fan-out -----------------------------------------------------------------

/** One source: the trimmed (non-empty) query in, its hits in the source's own order out. */
export type SearchSourceRunner = (query: string) => Promise<GlobalSearchHit[]>;

export type SearchSourceRunners = Readonly<Record<SearchSourceValue, SearchSourceRunner>>;

export interface SourceFailure {
  source: SearchSourceValue;
  error: unknown;
}

export interface GlobalSearchResult {
  /** The trimmed query these results answer. */
  query: string;
  groups: SearchGroup[];
  /** Sources that failed, in display order - the others are still listed. */
  failed: SourceFailure[];
}

function startSource(run: SearchSourceRunner, query: string): Promise<GlobalSearchHit[]> {
  try {
    return run(query);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Runs every source concurrently and federates what came back. Each source
 * fails on its own (a knowledge base that can't load still lets notes, jobs...
 * show). All sources start synchronously, so the Dexie reads they open are made
 * inside the caller's `liveQuery` tick and stay tracked (§12.4: notes, links and
 * pins results are live).
 */
export async function runSearchSources(
  rawQuery: string,
  sources: SearchSourceRunners,
): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();
  if (query.length === 0) return { query, groups: [], failed: [] };

  const settled = await Promise.allSettled(
    SEARCH_SOURCE_ORDER.map((source) => startSource(sources[source], query)),
  );
  const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>();
  const failed: SourceFailure[] = [];
  SEARCH_SOURCE_ORDER.forEach((source, i) => {
    const outcome = settled[i]!;
    if (outcome.status === 'fulfilled') bySource.set(source, outcome.value);
    else failed.push({ source, error: outcome.reason });
  });
  return { query, groups: federateSearchResults(bySource), failed };
}
