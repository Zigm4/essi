/**
 * The Favorites list (/menu/favorites): every starred row of the `favorites`
 * table, grouped by kind, each resolved to a label and the screen it opens.
 * Pure - the view loads the sources (jobs, KB, installed maps, fishing zones,
 * tracker catalog) and passes what it has.
 *
 * A source that is still loading or failed resolves its rows to their raw id
 * (still openable when the link needs no data); an item the loaded data no
 * longer has (job dropped, map not installed) shows its raw id, can't be
 * opened, and can still be unstarred.
 */

import { FavoriteKind, type FavoriteKindValue, type FavoriteRow } from '../../data/db';
import type { MapDocument } from '../knowledge/maps/model/types';
import { zoneLocation, zoneSubtitle } from '../search/searchSources';
import type { FishingRoom, FishingZone } from '../tools/fishing/fishingData';
import type { Job } from '../tools/jobs/jobModel';
import { jobRoute, typeWord } from '../tools/jobs/jobShare';
import { factionInfo } from '../tools/jobs/jobTaxonomies';
import { guessKind, resolvePin, type TrackedObject } from '../tools/nasa/catalog';
import { describeMajorBody, majorBodyFromId } from '../tools/nasa/majorBodies';
import type { TrackTarget } from '../tools/nasa/trackerClient';

/** Group order on the page. */
export const FAVORITE_GROUP_ORDER: readonly FavoriteKindValue[] = [
  FavoriteKind.job,
  FavoriteKind.kbArticle,
  FavoriteKind.map,
  FavoriteKind.mapZone,
  FavoriteKind.fishingZone,
  FavoriteKind.trackedObject,
];

export const FAVORITE_GROUP_TITLES: Record<FavoriteKindValue, string> = {
  job: 'Jobs',
  kb_article: 'Articles',
  map: 'Maps',
  map_zone: 'Map zones',
  fishing_zone: 'Fishing zones',
  tracked_object: 'Tracked objects',
};

const KNOWN_KINDS: ReadonlySet<string> = new Set(FAVORITE_GROUP_ORDER);

export function isFavoriteKind(kind: string): kind is FavoriteKindValue {
  return KNOWN_KINDS.has(kind);
}

// --- Sources -------------------------------------------------------------------

/** One data source as the view holds it. */
export type SourceState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'failed' };

/** The installed maps a favorite can name. */
export interface MapLabels {
  /** Installed maps by id. */
  readonly maps: ReadonlyMap<string, { readonly title: string; readonly subtitle: string | null }>;
  /** `mapId/zoneId` → the zone's row, for the maps whose document was read. */
  readonly zones: ReadonlyMap<string, { readonly name: string; readonly subtitle: string }>;
  /** Maps whose document was read: a zone they lack is gone. */
  readonly readDocs: ReadonlySet<string>;
}

/** A fishing zone with its room (the room decides the link). */
export interface FishingSpot {
  readonly zone: FishingZone;
  readonly room: FishingRoom;
}

export interface FavoriteSources {
  /** Job id → job (first row of a duplicated id). */
  readonly jobs: SourceState<ReadonlyMap<number, Job>>;
  /** Slug → article. */
  readonly articles: SourceState<ReadonlyMap<string, { readonly title: string; readonly categoryTitle: string }>>;
  /** Maps and map zones. */
  readonly maps: SourceState<MapLabels>;
  /** `String(zone.id)` → zone + room. */
  readonly fishing: SourceState<ReadonlyMap<string, FishingSpot>>;
  /** The Tracker's curated catalog (empty when it couldn't load). */
  readonly tracked: SourceState<readonly TrackedObject[]>;
}

/** The source a kind's labels come from. */
export function sourceOf(kind: FavoriteKindValue): keyof FavoriteSources {
  switch (kind) {
    case 'job':
      return 'jobs';
    case 'kb_article':
      return 'articles';
    case 'map':
    case 'map_zone':
      return 'maps';
    case 'fishing_zone':
      return 'fishing';
    case 'tracked_object':
      return 'tracked';
  }
}

// --- Builders for the sources --------------------------------------------------

export function jobsById(jobs: readonly Job[]): Map<number, Job> {
  const byId = new Map<number, Job>();
  for (const job of jobs) if (!byId.has(job.id)) byId.set(job.id, job);
  return byId;
}

export function fishingSpots(rooms: readonly FishingRoom[]): Map<string, FishingSpot> {
  const spots = new Map<string, FishingSpot>();
  for (const room of rooms) for (const zone of room.zones) spots.set(String(zone.id), { zone, room });
  return spots;
}

/** Labels from the installed manifest plus the documents that were read. */
export function buildMapLabels(
  descriptors: readonly { id: string; title: string; subtitle: string | null }[],
  docs: readonly { mapTitle: string; doc: MapDocument }[],
): MapLabels {
  const maps = new Map(descriptors.map((d) => [d.id, { title: d.title, subtitle: d.subtitle }]));
  const zones = new Map<string, { name: string; subtitle: string }>();
  const readDocs = new Set<string>();
  for (const { mapTitle, doc } of docs) {
    readDocs.add(doc.id);
    for (const zone of doc.zones) {
      zones.set(`${doc.id}/${zone.id}`, { name: zone.name, subtitle: zoneSubtitle(mapTitle, doc, zone) });
    }
  }
  return { maps, zones, readDocs };
}

/** `mapId/zoneId` → its parts (split on the first `/`), or null. */
export function splitZoneKey(id: string): { mapId: string; zoneId: string } | null {
  const slash = id.indexOf('/');
  if (slash <= 0 || slash === id.length - 1) return null;
  return { mapId: id.slice(0, slash), zoneId: id.slice(slash + 1) };
}

/** The map ids the zone favorites point at, sorted (the map source loads these documents). */
export function zoneMapIds(rows: readonly FavoriteRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.entityType !== FavoriteKind.mapZone) continue;
    const key = splitZoneKey(row.entityId);
    if (key !== null) ids.add(key.mapId);
  }
  return [...ids].sort();
}

// --- Items ---------------------------------------------------------------------

/** Where a row leads: a route, plus router state for the Tracker prefill. */
export interface FavoriteTarget {
  readonly location: string;
  readonly state?: TrackTarget;
}

export interface FavoriteItem {
  readonly kind: FavoriteKindValue;
  readonly id: string;
  readonly title: string;
  /** Empty when there is nothing to add. */
  readonly subtitle: string;
  /** False when the loaded data no longer has it: raw id, not openable. */
  readonly known: boolean;
  /** Null when the row can't be opened. */
  readonly target: FavoriteTarget | null;
}

function item(
  kind: FavoriteKindValue,
  id: string,
  title: string,
  subtitle: string,
  target: FavoriteTarget | null,
): FavoriteItem {
  return { kind, id, title, subtitle, known: true, target };
}

function gone(kind: FavoriteKindValue, id: string, title: string, why: string): FavoriteItem {
  return { kind, id, title, subtitle: why, known: false, target: null };
}

function resolveJob(id: string, jobs: FavoriteSources['jobs']): FavoriteItem {
  const kind = FavoriteKind.job;
  const num = /^\d{1,12}$/.test(id) ? Number(id) : null;
  if (num === null) return gone(kind, id, id, 'Not a job ID');
  const target = { location: jobRoute(num) };
  if (jobs.status !== 'ready') return item(kind, id, `#${id}`, '', target);
  const job = jobs.data.get(num);
  if (job === undefined) return gone(kind, id, `#${id}`, 'No longer in the job list');
  const giver = job.factionRep === null ? 'No faction' : factionInfo(job.factionRep).fullLabel;
  return item(kind, id, `${typeWord(job)} #${job.id}`, giver, target);
}

function resolveArticle(id: string, articles: FavoriteSources['articles']): FavoriteItem {
  const kind = FavoriteKind.kbArticle;
  const target = { location: `/knowledge/article/${encodeURIComponent(id)}` };
  if (articles.status !== 'ready') return item(kind, id, id, '', target);
  const article = articles.data.get(id);
  if (article === undefined) return gone(kind, id, id, 'No longer in the knowledge base');
  return item(kind, id, article.title, article.categoryTitle, target);
}

function resolveMap(id: string, maps: FavoriteSources['maps']): FavoriteItem {
  const kind = FavoriteKind.map;
  const target = { location: `/knowledge/maps/${encodeURIComponent(id)}` };
  if (maps.status !== 'ready') return item(kind, id, id, '', target);
  const map = maps.data.maps.get(id);
  if (map === undefined) return gone(kind, id, id, 'Map not installed');
  const subtitle = map.subtitle !== null && map.subtitle.length > 0 ? map.subtitle : 'Interactive map';
  return item(kind, id, map.title, subtitle, target);
}

function resolveZone(id: string, maps: FavoriteSources['maps']): FavoriteItem {
  const kind = FavoriteKind.mapZone;
  const key = splitZoneKey(id);
  if (key === null) return gone(kind, id, id, 'Not a map zone');
  const target = { location: zoneLocation(key.mapId, key.zoneId) };
  if (maps.status !== 'ready') return item(kind, id, id, '', target);
  const map = maps.data.maps.get(key.mapId);
  if (map === undefined) return gone(kind, id, id, 'Map not installed');
  const zone = maps.data.zones.get(id);
  if (zone !== undefined) return item(kind, id, zone.name.length > 0 ? zone.name : 'Zone', zone.subtitle, target);
  // The map is there but its document couldn't be read: still open it.
  if (!maps.data.readDocs.has(key.mapId)) return item(kind, id, key.zoneId, map.title, target);
  return gone(kind, id, id, `No longer on ${map.title}`);
}

function resolveFishing(id: string, fishing: FavoriteSources['fishing']): FavoriteItem {
  const kind = FavoriteKind.fishingZone;
  // Without the data the room is unknown: open the Fishing tool.
  if (fishing.status !== 'ready') return item(kind, id, `Zone ${id}`, '', { location: '/tools/fishing' });
  const spot = fishing.data.get(id);
  if (spot === undefined) return gone(kind, id, id, 'No longer on the fishing map');
  const { zone, room } = spot;
  const roomPath = `/tools/fishing/${encodeURIComponent(room.id)}`;
  const where = zone.accessible ? `Depth: ${zone.depth ?? 'n/a'}` : 'Not accessible';
  // A one-zone room is the zone; in the river grid `?zone=` opens its sheet.
  if (room.isSolo) return item(kind, id, room.name, `Map room · ${where}`, { location: roomPath });
  const named = zone.name.length > 0 && zone.name !== 'Unknown';
  const title = named ? `Zone ${zone.id} · ${zone.name}` : `Zone ${zone.id}`;
  return item(kind, id, title, `${room.name} · ${where}`, { location: `${roomPath}?zone=${zone.id}` });
}

function capitalized(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function resolveTracked(id: string, tracked: FavoriteSources['tracked']): FavoriteItem {
  const kind = FavoriteKind.trackedObject;
  const tracker = (state: TrackTarget): FavoriteTarget => ({ location: '/tools/tracker', state });
  // Planets and moons are pinned by their Horizons id (`jpl:502`).
  const body = majorBodyFromId(id);
  if (body !== null) {
    const trackKind = body.type === 'moon' ? 'moon' : 'planet';
    return item(kind, id, body.name, describeMajorBody(body), tracker({ name: body.name, kind: trackKind, mpcID: id }));
  }
  if (id.startsWith('jpl:')) return gone(kind, id, id, 'Unknown planet or moon');
  // MPC designations: a catalog name when there is one; any designation can be tracked.
  const pin = tracked.status === 'ready' ? resolvePin(tracked.data, id) : { id, label: id, kind: guessKind(id) };
  const subtitle = pin.label === id ? capitalized(pin.kind) : `${capitalized(pin.kind)} · ${id}`;
  return item(kind, id, pin.label, subtitle, tracker({ name: pin.label, kind: pin.kind, mpcID: id }));
}

/** One favorite's label and link. */
export function resolveFavorite(kind: FavoriteKindValue, id: string, sources: FavoriteSources): FavoriteItem {
  switch (kind) {
    case 'job':
      return resolveJob(id, sources.jobs);
    case 'kb_article':
      return resolveArticle(id, sources.articles);
    case 'map':
      return resolveMap(id, sources.maps);
    case 'map_zone':
      return resolveZone(id, sources.maps);
    case 'fishing_zone':
      return resolveFishing(id, sources.fishing);
    case 'tracked_object':
      return resolveTracked(id, sources.tracked);
  }
}

// --- Groups --------------------------------------------------------------------

export interface FavoriteGroup {
  readonly kind: FavoriteKindValue;
  readonly title: string;
  /** Its source's state: `loading` → the view waits, `failed` → raw ids with a note. */
  readonly status: SourceState<unknown>['status'];
  /** Sorted by title (numbers in order), then id. */
  readonly items: readonly FavoriteItem[];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** The kinds that have at least one favorite (a source is only loaded when needed). */
export function kindsIn(rows: readonly FavoriteRow[]): Set<FavoriteKindValue> {
  const kinds = new Set<FavoriteKindValue>();
  for (const row of rows) if (isFavoriteKind(row.entityType)) kinds.add(row.entityType);
  return kinds;
}

/** Non-empty groups in page order; rows of unknown kinds are left out. */
export function groupFavorites(rows: readonly FavoriteRow[], sources: FavoriteSources): FavoriteGroup[] {
  const byKind = new Map<FavoriteKindValue, FavoriteItem[]>();
  for (const row of rows) {
    if (!isFavoriteKind(row.entityType)) continue;
    const list = byKind.get(row.entityType) ?? [];
    list.push(resolveFavorite(row.entityType, row.entityId, sources));
    byKind.set(row.entityType, list);
  }
  const groups: FavoriteGroup[] = [];
  for (const kind of FAVORITE_GROUP_ORDER) {
    const items = byKind.get(kind);
    if (items === undefined) continue;
    items.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.id, b.id));
    groups.push({ kind, title: FAVORITE_GROUP_TITLES[kind], status: sources[sourceOf(kind)].status, items });
  }
  return groups;
}
