import { db } from '../../data/db';
import { loadKBData, type KBData } from '../knowledge/data/kbLoader';

/**
 * Federated global search (knowledge spec §11-12). A single query is fanned out
 * to 6 sources in a fixed order; each group is capped at 5 visible rows.
 *
 * Backend availability today:
 *  - kbArticle, capture (notes + links), mapPin  -> ACTIVE (KB index / shared
 *    Dexie tables `db.notes`, `db.links`, `db.mapPins`).
 *  - mapZone, job, wallet -> STUB (return []). They delegate to modules owned by
 *    other areas that do not exist yet: `mapZoneSearchProvider` (maps spec, needs
 *    the FTS index + map metadata to drop draft/unknown maps), the jobs list +
 *    job-detail modal (tools area - job hits open a modal, there is no route),
 *    and `wallet.search` (wallet tool). The engine keeps all 6 registered in
 *    order so wiring each is a one-function change. See return notes.
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

// --- Source adapters ---------------------------------------------------------

/** 2. KB articles - the index's alphabetical order (§12.4). */
function kbArticleHits(kb: KBData, query: string): GlobalSearchHit[] {
  const hits: GlobalSearchHit[] = [];
  for (const slug of kb.index.search(query)) {
    const article = kb.articles.get(slug);
    if (article === undefined) continue;
    hits.push({
      source: SearchSource.kbArticle,
      title: article.title,
      subtitle: article.categoryTitle,
      icon: 'menu_book',
      target: { kind: 'route', location: `/knowledge/article/${encodeURIComponent(article.slug)}` },
    });
  }
  return hits;
}

/** 5. Captures - notes then links, substring match (§12.4). */
async function captureHits(q: string): Promise<GlobalSearchHit[]> {
  const [notes, links] = await Promise.all([db.notes.toArray(), db.links.toArray()]);
  const hits: GlobalSearchHit[] = [];
  for (const note of notes) {
    if (`${note.title} ${note.body}`.toLowerCase().includes(q)) {
      hits.push({
        source: SearchSource.capture,
        title: note.title.trim().length > 0 ? note.title : 'Untitled note',
        subtitle: snippet(note.body),
        icon: 'note',
        target: { kind: 'route', location: `/captures/note/${encodeURIComponent(note.id)}` },
      });
    }
  }
  for (const link of links) {
    if (`${link.title} ${link.url} ${link.note}`.toLowerCase().includes(q)) {
      hits.push({
        source: SearchSource.capture,
        title: link.title.trim().length > 0 ? link.title : link.url,
        subtitle: link.url,
        icon: 'link',
        target: { kind: 'route', location: `/captures/link/${encodeURIComponent(link.id)}` },
      });
    }
  }
  return hits;
}

/** 6. Map pins - personal zone notes, substring match (§12.4). */
async function mapPinHits(q: string): Promise<GlobalSearchHit[]> {
  const pins = await db.mapPins.toArray();
  const hits: GlobalSearchHit[] = [];
  for (const pin of pins) {
    if (pin.note.toLowerCase().includes(q)) {
      hits.push({
        source: SearchSource.mapPin,
        title: snippet(pin.note),
        subtitle: 'Pinned zone note',
        icon: 'pin',
        target: {
          kind: 'route',
          location: `/knowledge/maps/${encodeURIComponent(pin.mapId)}?zone=${encodeURIComponent(pin.zoneId)}`,
        },
      });
    }
  }
  return hits;
}

/**
 * Runs all sources concurrently and federates. Reads `db.notes`, `db.links`,
 * `db.mapPins` inside the (Dexie-tracked) call, so wrapping this in `liveQuery`
 * keeps notes/links/pins results live - edits re-emit and recompute (§12.4).
 */
export async function runGlobalSearch(rawQuery: string): Promise<SearchGroup[]> {
  const query = rawQuery.trim();
  if (query.length === 0) return [];
  const q = query.toLowerCase();

  const kb = await loadKBData();
  const [captures, pins] = await Promise.all([captureHits(q), mapPinHits(q)]);

  const bySource = new Map<SearchSourceValue, GlobalSearchHit[]>([
    // STUB - maps spec `mapZoneSearchProvider` (FTS5 over zone fields).
    [SearchSource.mapZone, []],
    [SearchSource.kbArticle, kbArticleHits(kb, query)],
    // STUB - tools area jobs list + job-detail modal (JobTarget has no route).
    [SearchSource.job, []],
    // STUB - wallet tool `wallet.search` (owner/wallet substring + dedup).
    [SearchSource.wallet, []],
    [SearchSource.capture, captures],
    [SearchSource.mapPin, pins],
  ]);

  return federateSearchResults(bySource);
}
