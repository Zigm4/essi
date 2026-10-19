import { db } from '../../data/db';
import { loadKBData, type KBData } from '../knowledge/data/kbLoader';
import { loadDocument, loadInstalledManifest } from '../knowledge/maps/data/repository';
import { buildSearchIndex, searchZones, type MapSearchIndex } from '../knowledge/maps/data/search';
import type { MapDescriptor, MapDocument, MapZone } from '../knowledge/maps/model/types';
import { parseJobsJson, type Job } from '../tools/jobs/jobModel';
import { buildPlaces } from '../tools/jobs/jobPlaces';
import { factionInfo } from '../tools/jobs/jobTaxonomies';
import { jobHaystack, parseQuery } from '../tools/jobs/jobsLogic';
import { loadCatalog } from '../tools/shared/catalog';
import { stripMarkdown } from '../tools/shared/markdown';
import { parseWallets, search as searchWallets, type WalletOwner } from '../tools/wallet/walletData';
import {
  runSearchSources,
  SearchSource,
  snippet,
  type GlobalSearchHit,
  type GlobalSearchResult,
  type SearchSourceRunners,
} from './globalSearch';

/**
 * The six global-search sources (§12.4). Catalog data (KB, jobs, wallets) is
 * loaded once and kept; the map-zone index is rebuilt only when the installed
 * maps change; notes, links and pins are read fresh on every run (live).
 */

function zoneLocation(mapId: string, zoneId: string): string {
  return `/knowledge/maps/${encodeURIComponent(mapId)}?zone=${encodeURIComponent(zoneId)}`;
}

/** Loads once and keeps the result; a failure is not kept, so the next search retries. */
function cachedLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (cached === null) {
      const pending = load();
      cached = pending;
      pending.catch(() => {
        if (cached === pending) cached = null;
      });
    }
    return cached;
  };
}

// --- 1. Map zones --------------------------------------------------------------

interface ZoneEntry {
  mapId: string;
  zoneId: string;
  name: string;
  subtitle: string;
}

/** The installed maps' zones: the in-map search index plus what a row shows. */
export interface ZoneCorpus {
  index: MapSearchIndex;
  /** `mapId/zoneId` → row. */
  zones: ReadonlyMap<string, ZoneEntry>;
  /** Zone number → its zones, in map order. */
  byNumber: ReadonlyMap<number, ZoneEntry[]>;
}

function zoneKey(mapId: string, zoneId: string): string {
  return `${mapId}/${zoneId}`;
}

/** `Mars · Lalothen`: the map, then the zone's short searchable values (owner, region...). */
function zoneSubtitle(mapTitle: string, doc: MapDocument, zone: MapZone): string {
  const parts = [mapTitle];
  for (const field of doc.fieldsSchema) {
    if (!field.searchable || (field.type !== 'enum' && field.type !== 'text')) continue;
    const value = zone.fields[field.key];
    if (typeof value === 'string' && value.trim().length > 0) parts.push(value.trim());
    else if (typeof value === 'number') parts.push(String(value));
  }
  return snippet(parts.join(' · '));
}

/** Builds the corpus from the openable maps (drafts and unsupported docs dropped, as in the maps area). */
export function buildZoneCorpus(maps: readonly { descriptor: MapDescriptor; doc: MapDocument }[]): ZoneCorpus {
  const index = buildSearchIndex(maps);
  const indexed = new Set(index.entries.map((entry) => entry.mapId));
  const zones = new Map<string, ZoneEntry>();
  const byNumber = new Map<number, ZoneEntry[]>();
  const ordered = [...maps].sort((a, b) => a.descriptor.order - b.descriptor.order);
  for (const { descriptor, doc } of ordered) {
    if (!indexed.has(doc.id)) continue;
    for (const zone of doc.zones) {
      const entry: ZoneEntry = {
        mapId: doc.id,
        zoneId: zone.id,
        name: zone.name,
        subtitle: zoneSubtitle(descriptor.title, doc, zone),
      };
      zones.set(zoneKey(doc.id, zone.id), entry);
      if (zone.cellNum !== null) {
        const list = byNumber.get(zone.cellNum);
        if (list === undefined) byNumber.set(zone.cellNum, [entry]);
        else list.push(entry);
      }
    }
  }
  return { index, zones, byNumber };
}

/** `35`, `035`, `#35`, `z35`, `zone 35` → 35. */
const ZONE_NUMBER_RE = /^(?:z|zone\s*|#)?0*(\d{1,5})$/i;

/**
 * 1. Map zones: a zone-number query lists that number's zones first (every
 * map), then the in-map full-text search (name + searchable fields, relevance
 * order) across all installed maps.
 */
export function zoneHits(corpus: ZoneCorpus, query: string): GlobalSearchHit[] {
  const hits: GlobalSearchHit[] = [];
  const seen = new Set<string>();
  const add = (entry: ZoneEntry): void => {
    const key = zoneKey(entry.mapId, entry.zoneId);
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({
      source: SearchSource.mapZone,
      title: entry.name,
      subtitle: entry.subtitle,
      icon: 'map',
      target: { kind: 'route', location: zoneLocation(entry.mapId, entry.zoneId) },
    });
  };
  const number = ZONE_NUMBER_RE.exec(query.trim());
  if (number !== null) for (const entry of corpus.byNumber.get(Number(number[1])) ?? []) add(entry);
  for (const hit of searchZones(corpus.index, query, corpus.index.entries.length)) {
    const entry = corpus.zones.get(zoneKey(hit.mapId, hit.zoneId));
    if (entry !== undefined) add(entry);
  }
  return hits;
}

let zoneCorpusCache: { key: string; corpus: Promise<ZoneCorpus> } | null = null;

async function loadZoneCorpus(descriptors: readonly MapDescriptor[]): Promise<ZoneCorpus> {
  const maps: { descriptor: MapDescriptor; doc: MapDocument }[] = [];
  for (const descriptor of descriptors) {
    if (descriptor.draft) continue;
    const doc = await loadDocument(descriptor.id);
    if (doc !== null) maps.push({ descriptor, doc });
  }
  return buildZoneCorpus(maps);
}

/** The installed maps' corpus (IndexedDB), rebuilt only when the installed documents change. */
async function installedZoneCorpus(): Promise<ZoneCorpus | null> {
  const manifest = await loadInstalledManifest();
  if (manifest === null) return null;
  const key = manifest.maps.map((m) => `${m.id}@${m.document.sha256}${m.draft ? '~' : ''}`).join('|');
  if (zoneCorpusCache === null || zoneCorpusCache.key !== key) {
    const entry = { key, corpus: loadZoneCorpus(manifest.maps) };
    zoneCorpusCache = entry;
    entry.corpus.catch(() => {
      if (zoneCorpusCache === entry) zoneCorpusCache = null;
    });
  }
  return zoneCorpusCache.corpus;
}

// --- 2. KB articles ------------------------------------------------------------

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

// --- 3. Jobs -------------------------------------------------------------------

export interface JobsCorpus {
  jobs: readonly Job[];
  /** The Jobs place picker's zone names - searchable, as in the tool. */
  zoneNames: ReadonlyMap<string, string>;
}

export function buildJobsCorpus(raw: unknown): JobsCorpus {
  const jobs = parseJobsJson(raw);
  return { jobs, zoneNames: buildPlaces(jobs).zoneNames };
}

const loadJobsCorpus = cachedLoader(async () => buildJobsCorpus(await loadCatalog<unknown>('jobs.json')));

/**
 * 3. Jobs - the Jobs tool's own search: every word must be in the job's
 * haystack (ID with or without `#`, faction codes and names, places, reward,
 * type, texts...). The exact ID comes first, then ID order; one row per ID.
 */
export function jobHits(corpus: JobsCorpus, query: string): GlobalSearchHit[] {
  const words = parseQuery(query);
  if (words.length === 0) return [];
  const exactId = words.length === 1 ? words[0] : null;
  const seen = new Set<number>();
  const matches: Job[] = [];
  for (const job of corpus.jobs) {
    if (seen.has(job.id)) continue;
    const haystack = jobHaystack(job, corpus.zoneNames);
    if (!words.every((word) => haystack.includes(word))) continue;
    seen.add(job.id);
    matches.push(job);
  }
  const isExact = (job: Job): number => (String(job.id) === exactId ? 0 : 1);
  matches.sort((a, b) => isExact(a) - isExact(b) || a.id - b.id);
  return matches.map((job) => {
    const giver = job.factionRep === null ? null : factionInfo(job.factionRep).label;
    return {
      source: SearchSource.job,
      title: giver === null ? `Job #${job.id}` : `Job #${job.id} · ${giver}`,
      subtitle: snippet(stripMarkdown(job.description)),
      icon: 'work',
      target: { kind: 'job', jobId: String(job.id) },
    };
  });
}

// --- 4. Wallets ----------------------------------------------------------------

const loadWalletOwners = cachedLoader(async () => parseWallets(await loadCatalog<unknown>('wallets.json')));

/**
 * 4. Wallets - Wallet Lookup's own search: owners whose name or Discord handle
 * matches, then the matching wallets of the other owners. A row opens Wallet
 * Lookup on that owner (handle, else name) or that wallet.
 */
export function walletHits(owners: WalletOwner[], query: string): GlobalSearchHit[] {
  const { ownerHits, walletHits: matchingWallets } = searchWallets(query, owners);
  const hits: GlobalSearchHit[] = [];
  for (const owner of ownerHits) {
    const handle = owner.discord_username === null ? [] : [`@${owner.discord_username}`];
    const wallets = owner.wallets.length > 0 ? owner.wallets.join(', ') : 'No wallet on file';
    hits.push({
      source: SearchSource.wallet,
      title: owner.display_name,
      subtitle: snippet([...handle, wallets].join(' · ')),
      icon: 'person',
      target: { kind: 'wallet', query: owner.discord_username ?? owner.display_name },
    });
  }
  for (const { wallet, owner } of matchingWallets) {
    hits.push({
      source: SearchSource.wallet,
      title: wallet,
      subtitle: snippet(`Owner: ${owner.display_name}`),
      icon: 'wallet',
      target: { kind: 'wallet', query: wallet },
    });
  }
  return hits;
}

// --- 5-6. Personal data (Dexie, live) ----------------------------------------------

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
        target: { kind: 'route', location: zoneLocation(pin.mapId, pin.zoneId) },
      });
    }
  }
  return hits;
}

// --- Wiring ----------------------------------------------------------------------

export const GLOBAL_SEARCH_SOURCES: SearchSourceRunners = {
  mapZone: async (query) => {
    const corpus = await installedZoneCorpus();
    return corpus === null ? [] : zoneHits(corpus, query);
  },
  kbArticle: async (query) => kbArticleHits(await loadKBData(), query),
  job: async (query) => jobHits(await loadJobsCorpus(), query),
  wallet: async (query) => walletHits(await loadWalletOwners(), query),
  capture: (query) => captureHits(query.toLowerCase()),
  mapPin: (query) => mapPinHits(query.toLowerCase()),
};

/**
 * The global search. Notes, links and pins (and the installed maps) are read
 * inside the call, so wrapping it in `liveQuery` keeps those results live -
 * edits re-emit and recompute (§12.4).
 */
export function runGlobalSearch(rawQuery: string): Promise<GlobalSearchResult> {
  return runSearchSources(rawQuery, GLOBAL_SEARCH_SOURCES);
}
