import Dexie, { type Table } from 'dexie';
import { localChangesMiddleware, markLocalChange } from './localChanges';

/**
 * IndexedDB database `underdeck` - faithful mirror of the Drift/SQLite schema
 * (data-layer spec §2.3 / §10). All ids of user content are client-generated
 * UUID v4 strings; all timestamps are stored as epoch milliseconds (the export
 * format converts to ISO-8601 UTC strings).
 *
 * IndexedDB has no foreign keys: cascade deletes are done manually via the
 * delete*Cascade helpers below, inside one transaction.
 */

export interface NoteRow {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface LinkRow {
  id: string;
  title: string;
  url: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface TagRow {
  id: string;
  /** As typed by the user. */
  displayName: string;
  /** Lowercase dedupe key - unique. */
  name: string;
  colorHex: string | null;
}

export interface NoteTagRow {
  noteId: string;
  tagId: string;
}

export interface LinkTagRow {
  linkId: string;
  tagId: string;
}

export interface ShipTagRow {
  shipId: string;
  tagId: string;
}

/** The 12 crew-name columns correspond to the game's 12 crew roles. */
export interface ShipRow {
  id: string;
  name: string;
  modelKey: string | null;
  customModelLabel: string | null;
  registered: boolean;
  locationKey: string | null;
  customLocation: string | null;
  locationZone: number | null;
  locationSector: string | null;
  locationSL: number | null;
  hull: number | null;
  pilotName: string | null;
  gunnerName: string | null;
  cartographerName: string | null;
  prospectorName: string | null;
  signallerName: string | null;
  technicianName: string | null;
  sentryName: string | null;
  fabricatorName: string | null;
  medicName: string | null;
  quartermasterName: string | null;
  chefName: string | null;
  alchemistName: string | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** scan: 'light'|'full'; tracker: 'asteroid'|'comet'; discovery: 'asteroid'|'comet'. */
export interface HistoryRow {
  id: string;
  date: number;
  mode: string;
  /** Raw JSON blob (double-encoded inside exports) - schemas in data-layer §3. */
  payloadJson: string;
  errored: boolean;
}

export const FavoriteKind = {
  job: 'job',
  kbArticle: 'kb_article',
  fishingZone: 'fishing_zone',
  trackedObject: 'tracked_object',
  map: 'map',
  /** entityId namespaced as `mapId/zoneId`. */
  mapZone: 'map_zone',
} as const;

export type FavoriteKindValue = (typeof FavoriteKind)[keyof typeof FavoriteKind];

export interface FavoriteRow {
  entityType: string;
  entityId: string;
  createdAt: number;
}

/**
 * Tombstone of an un-starred favorite: an older backup that still has the star
 * must not bring it back on import. Never coexists with a `favorites` row for
 * the same key (starring again deletes it).
 */
export interface RemovedFavoriteRow {
  entityType: string;
  entityId: string;
  removedAt: number;
}

/** Tables whose deletions are remembered in `deletions` (data-layer §2.3). */
export const DELETION_TABLES = [
  'notes',
  'links',
  'ships',
  'tags',
  'mapPins',
  'scanHistory',
  'trackerHistory',
  'discoveryHistory',
] as const;

export type DeletionTable = (typeof DELETION_TABLES)[number];

/**
 * Tombstone of a deleted record: an older backup that still has the record
 * must not bring it back on import. `key` is what the import matches records
 * by - the row id; a tag's lowercase name (tags merge by name); a zone note's
 * `mapId/zoneId` (one note per zone). Never coexists with a live record:
 * re-creating it (Undo, a tag of that name, a note on that zone) deletes it.
 */
export interface DeletionRow {
  table: DeletionTable;
  key: string;
  deletedAt: number;
}

export type JobStatusValue = 'todo' | 'in_progress' | 'done';

/**
 * A job with no row, or with a 'todo' row, is 'todo'. Resetting a job keeps a
 * dated 'todo' row (never a delete) so newer-wins on import can see the reset.
 */
export interface JobStatusRow {
  jobId: string;
  status: JobStatusValue;
  updatedAt: number;
}

export interface MapPackRow {
  contentVersion: string;
  tag: string;
  manifestSha256: string;
  installedAt: number;
  state: 'installed' | 'downloading' | 'failed';
}

export interface MapPackFileRow {
  contentVersion: string;
  logicalPath: string;
  sha256: string;
  bytes: number;
  kind: string | null;
}

export interface MapPinRow {
  id: string;
  /** Deliberately NOT an FK - a pin must outlive a temporarily-uninstalled pack. */
  mapId: string;
  zoneId: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** Web mirror of the content-addressed filesystem blob store. */
export interface MapBlobRow {
  sha256: string;
  data: Blob;
}

/** Every history list query is ORDER BY date DESC LIMIT 100. */
export const HISTORY_LIMIT = 100;

/**
 * Tables holding user data - what the JSON export carries. Writes to these bump
 * the local-change marker (backup reminder); the map pack index and blob cache
 * are rebuildable and deliberately left out.
 */
export const USER_DATA_TABLES: ReadonlySet<string> = new Set([
  'notes',
  'links',
  'tags',
  'noteTags',
  'linkTags',
  'shipTags',
  'ships',
  'scanHistory',
  'trackerHistory',
  'discoveryHistory',
  'favorites',
  'removedFavorites',
  'jobStatus',
  'mapPins',
  'deletions',
]);

/**
 * Ids of the pins to drop so each (mapId, zoneId) keeps one: the most recently
 * updated (ties: the first seen). Older imports could create duplicates.
 */
export function duplicatePinIds(rows: readonly MapPinRow[]): string[] {
  const keep = new Map<string, MapPinRow>();
  const drop: string[] = [];
  for (const row of rows) {
    const zone = `${row.mapId}\u0000${row.zoneId}`;
    const kept = keep.get(zone);
    if (kept === undefined) {
      keep.set(zone, row);
    } else if (row.updatedAt > kept.updatedAt) {
      drop.push(kept.id);
      keep.set(zone, row);
    } else {
      drop.push(row.id);
    }
  }
  return drop;
}

export class UnderdeckDb extends Dexie {
  notes!: Table<NoteRow, string>;
  links!: Table<LinkRow, string>;
  tags!: Table<TagRow, string>;
  noteTags!: Table<NoteTagRow, [string, string]>;
  linkTags!: Table<LinkTagRow, [string, string]>;
  shipTags!: Table<ShipTagRow, [string, string]>;
  ships!: Table<ShipRow, string>;
  scanHistory!: Table<HistoryRow, string>;
  trackerHistory!: Table<HistoryRow, string>;
  discoveryHistory!: Table<HistoryRow, string>;
  favorites!: Table<FavoriteRow, [string, string]>;
  removedFavorites!: Table<RemovedFavoriteRow, [string, string]>;
  jobStatus!: Table<JobStatusRow, string>;
  mapPacks!: Table<MapPackRow, string>;
  mapPackFiles!: Table<MapPackFileRow, [string, string]>;
  mapPins!: Table<MapPinRow, string>;
  mapBlobs!: Table<MapBlobRow, string>;
  deletions!: Table<DeletionRow, [string, string]>;

  constructor() {
    super('underdeck');
    this.version(1).stores({
      notes: 'id, updatedAt',
      links: 'id, updatedAt',
      tags: 'id, &name',
      noteTags: '[noteId+tagId], noteId, tagId',
      linkTags: '[linkId+tagId], linkId, tagId',
      shipTags: '[shipId+tagId], shipId, tagId',
      ships: 'id, updatedAt',
      scanHistory: 'id, date',
      trackerHistory: 'id, date',
      discoveryHistory: 'id, date',
      favorites: '[entityType+entityId], entityType',
      jobStatus: 'jobId',
      mapPacks: 'contentVersion, state',
      mapPackFiles: '[contentVersion+logicalPath], sha256',
      mapPins: 'id, [mapId+zoneId], updatedAt',
      mapBlobs: 'sha256',
    });
    // v2: favorite tombstones; collapse the duplicate zone notes older
    // imports could create (newest wins, as the import now does).
    this.version(2)
      .stores({ removedFavorites: '[entityType+entityId]' })
      .upgrade(async (tx) => {
        const pins = tx.table<MapPinRow, string>('mapPins');
        const drop = duplicatePinIds(await pins.toArray());
        if (drop.length > 0) await pins.bulkDelete(drop);
      });
    // v3: tombstones of deleted notes, links, ships, tags, zone notes and
    // history entries. Additive: nothing was remembered before.
    this.version(3).stores({ deletions: '[table+key]' });
    this.use(localChangesMiddleware(USER_DATA_TABLES, () => markLocalChange()));
  }
}

export const db = new UnderdeckDb();

export function newUuid(): string {
  return crypto.randomUUID();
}

// --- Deletions (tombstones) --------------------------------------------------

/** `key` of a zone note's tombstone: one note per zone, whatever its id. */
export function zoneNoteKey(mapId: string, zoneId: string): string {
  return `${mapId}/${zoneId}`;
}

/** Remembers deleted records. Runs inside the caller's transaction (with `deletions`). */
export async function markDeleted(
  database: UnderdeckDb,
  table: DeletionTable,
  keys: readonly string[],
  deletedAt: number = Date.now(),
): Promise<void> {
  if (keys.length === 0) return;
  await database.deletions.bulkPut(keys.map((key) => ({ table, key, deletedAt })));
}

/** Forgets the tombstones of re-created records (same transaction rule). */
export async function clearDeleted(
  database: UnderdeckDb,
  table: DeletionTable,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;
  await database.deletions.bulkDelete(keys.map((key): [string, string] => [table, key]));
}

/**
 * Deletes every tag no note, link or ship uses any more and remembers each by
 * name. Runs inside the caller's transaction (tags, the three join tables and
 * deletions).
 */
export async function pruneOrphanTags(database: UnderdeckDb): Promise<void> {
  const [tags, noteTags, linkTags, shipTags] = await Promise.all([
    database.tags.toArray(),
    database.noteTags.toArray(),
    database.linkTags.toArray(),
    database.shipTags.toArray(),
  ]);
  const used = new Set<string>();
  for (const r of noteTags) used.add(r.tagId);
  for (const r of linkTags) used.add(r.tagId);
  for (const r of shipTags) used.add(r.tagId);
  const orphans = tags.filter((t) => !used.has(t.id));
  if (orphans.length === 0) return;
  await database.tags.bulkDelete(orphans.map((t) => t.id));
  await markDeleted(database, 'tags', orphans.map((t) => t.name));
}

// --- Manual ON DELETE CASCADE equivalents (IndexedDB has no FKs) --------------

/** A deleted note, link or ship with its tags: what Undo needs to put it back exactly. */
export interface DeletedRecord<T> {
  row: T;
  tags: TagRow[];
}

export type TaggedTable = 'notes' | 'links' | 'ships';

export interface RestorePlan {
  /** Pruned tags, re-created as they were. */
  createTags: TagRow[];
  /** What the relations point to: a tag still there (same id, or its name typed again since) is reused. */
  tagIds: string[];
  /** Tombstones to forget: the record's and each re-created tag's. */
  forget: { table: DeletionTable; key: string }[];
}

/** What an Undo writes to put a deleted note, link or ship back (pure). */
export function planRestore(
  table: TaggedTable,
  deleted: DeletedRecord<{ id: string }>,
  liveTags: readonly TagRow[],
): RestorePlan {
  const byId = new Map(liveTags.map((t) => [t.id, t]));
  const byName = new Map(liveTags.map((t) => [t.name, t]));
  const createTags: TagRow[] = [];
  const tagIds = new Set<string>();
  for (const tag of deleted.tags) {
    const found = byId.get(tag.id) ?? byName.get(tag.name);
    if (found !== undefined) {
      tagIds.add(found.id);
      continue;
    }
    createTags.push(tag);
    byId.set(tag.id, tag);
    byName.set(tag.name, tag);
    tagIds.add(tag.id);
  }
  return {
    createTags,
    tagIds: [...tagIds],
    forget: [
      { table, key: deleted.row.id },
      ...createTags.map((t) => ({ table: 'tags' as const, key: t.name })),
    ],
  };
}

/** One record's relation rows (each join table names its parent column differently). */
interface Relations {
  toArray: () => PromiseLike<{ tagId: string }[]>;
  delete: () => PromiseLike<number>;
}

function taggedScope(database: UnderdeckDb) {
  return [
    database.notes,
    database.links,
    database.ships,
    database.tags,
    database.noteTags,
    database.linkTags,
    database.shipTags,
    database.deletions,
  ];
}

/**
 * Deletes the record and its relations, remembers the deletion and prunes the
 * tags nothing uses any more, in one transaction. Resolves to what Undo needs,
 * or undefined when there was no such record.
 */
async function deleteTagged<T extends { id: string }>(
  database: UnderdeckDb,
  table: TaggedTable,
  rows: Table<T, string>,
  relations: () => Relations,
  id: string,
): Promise<DeletedRecord<T> | undefined> {
  return database.transaction('rw', taggedScope(database), async () => {
    const row = await rows.get(id);
    if (row === undefined) return undefined;
    const tagIds = (await relations().toArray()).map((r) => r.tagId);
    const tags = (await database.tags.bulkGet(tagIds)).filter((t): t is TagRow => t !== undefined);
    await relations().delete();
    await rows.delete(id);
    await markDeleted(database, table, [id]);
    await pruneOrphanTags(database);
    return { row, tags };
  });
}

/** Undo of deleteTagged: the row as it was, its tags and relations, no tombstones left. */
async function restoreTagged<T extends { id: string }>(
  database: UnderdeckDb,
  table: TaggedTable,
  rows: Table<T, string>,
  deleted: DeletedRecord<T>,
  putRelations: (tagIds: string[]) => PromiseLike<unknown>,
): Promise<void> {
  await database.transaction('rw', taggedScope(database), async () => {
    const plan = planRestore(table, deleted, await database.tags.toArray());
    if (plan.createTags.length > 0) await database.tags.bulkAdd(plan.createTags);
    await rows.put(deleted.row);
    if (plan.tagIds.length > 0) await putRelations(plan.tagIds);
    await database.deletions.bulkDelete(plan.forget.map((d): [string, string] => [d.table, d.key]));
  });
}

export function deleteNoteCascade(
  database: UnderdeckDb,
  noteId: string,
): Promise<DeletedRecord<NoteRow> | undefined> {
  return deleteTagged(
    database,
    'notes',
    database.notes,
    () => database.noteTags.where('noteId').equals(noteId),
    noteId,
  );
}

export function restoreNoteCascade(database: UnderdeckDb, deleted: DeletedRecord<NoteRow>): Promise<void> {
  const noteId = deleted.row.id;
  return restoreTagged(database, 'notes', database.notes, deleted, (tagIds) =>
    database.noteTags.bulkPut(tagIds.map((tagId) => ({ noteId, tagId }))),
  );
}

export function deleteLinkCascade(
  database: UnderdeckDb,
  linkId: string,
): Promise<DeletedRecord<LinkRow> | undefined> {
  return deleteTagged(
    database,
    'links',
    database.links,
    () => database.linkTags.where('linkId').equals(linkId),
    linkId,
  );
}

export function restoreLinkCascade(database: UnderdeckDb, deleted: DeletedRecord<LinkRow>): Promise<void> {
  const linkId = deleted.row.id;
  return restoreTagged(database, 'links', database.links, deleted, (tagIds) =>
    database.linkTags.bulkPut(tagIds.map((tagId) => ({ linkId, tagId }))),
  );
}

export function deleteShipCascade(
  database: UnderdeckDb,
  shipId: string,
): Promise<DeletedRecord<ShipRow> | undefined> {
  return deleteTagged(
    database,
    'ships',
    database.ships,
    () => database.shipTags.where('shipId').equals(shipId),
    shipId,
  );
}

export function restoreShipCascade(database: UnderdeckDb, deleted: DeletedRecord<ShipRow>): Promise<void> {
  const shipId = deleted.row.id;
  return restoreTagged(database, 'ships', database.ships, deleted, (tagIds) =>
    database.shipTags.bulkPut(tagIds.map((tagId) => ({ shipId, tagId }))),
  );
}

/**
 * Stars or un-stars (entityType, entityId) and returns the new state (true =
 * starred). Un-starring leaves a dated tombstone so importing an older backup
 * can't bring the star back; starring again removes it.
 */
export async function toggleFavoriteRow(
  database: UnderdeckDb,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const key: [string, string] = [entityType, entityId];
  return database.transaction('rw', database.favorites, database.removedFavorites, async () => {
    const now = Date.now();
    if ((await database.favorites.get(key)) !== undefined) {
      await database.favorites.delete(key);
      await database.removedFavorites.put({ entityType, entityId, removedAt: now });
      return false;
    }
    await database.removedFavorites.delete(key);
    await database.favorites.put({ entityType, entityId, createdAt: now });
    return true;
  });
}

/** Deletes a tag everywhere and remembers it by name. */
export async function deleteTagCascade(database: UnderdeckDb, tagId: string): Promise<void> {
  await database.transaction(
    'rw',
    [database.tags, database.noteTags, database.linkTags, database.shipTags, database.deletions],
    async () => {
      const tag = await database.tags.get(tagId);
      await database.noteTags.where('tagId').equals(tagId).delete();
      await database.linkTags.where('tagId').equals(tagId).delete();
      await database.shipTags.where('tagId').equals(tagId).delete();
      await database.tags.delete(tagId);
      if (tag !== undefined) await markDeleted(database, 'tags', [tag.name]);
    },
  );
}
