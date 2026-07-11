import Dexie, { type Table } from 'dexie';

/**
 * IndexedDB database `underdeck` — faithful mirror of the Drift/SQLite schema
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
  /** Lowercase dedupe key — unique. */
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
  /** Raw JSON blob (double-encoded inside exports) — schemas in data-layer §3. */
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

export type JobStatusValue = 'todo' | 'in_progress' | 'done';

/** A job with no row is implicitly 'todo'. */
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
  /** Deliberately NOT an FK — a pin must outlive a temporarily-uninstalled pack. */
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
  jobStatus!: Table<JobStatusRow, string>;
  mapPacks!: Table<MapPackRow, string>;
  mapPackFiles!: Table<MapPackFileRow, [string, string]>;
  mapPins!: Table<MapPinRow, string>;
  mapBlobs!: Table<MapBlobRow, string>;

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
  }
}

export const db = new UnderdeckDb();

export function newUuid(): string {
  return crypto.randomUUID();
}

/** Manual ON DELETE CASCADE equivalents (IndexedDB has no FKs). */

export async function deleteNoteCascade(database: UnderdeckDb, noteId: string): Promise<void> {
  await database.transaction('rw', database.notes, database.noteTags, async () => {
    await database.noteTags.where('noteId').equals(noteId).delete();
    await database.notes.delete(noteId);
  });
}

export async function deleteLinkCascade(database: UnderdeckDb, linkId: string): Promise<void> {
  await database.transaction('rw', database.links, database.linkTags, async () => {
    await database.linkTags.where('linkId').equals(linkId).delete();
    await database.links.delete(linkId);
  });
}

export async function deleteShipCascade(database: UnderdeckDb, shipId: string): Promise<void> {
  await database.transaction('rw', database.ships, database.shipTags, async () => {
    await database.shipTags.where('shipId').equals(shipId).delete();
    await database.ships.delete(shipId);
  });
}

export async function deleteTagCascade(database: UnderdeckDb, tagId: string): Promise<void> {
  await database.transaction(
    'rw',
    database.tags,
    database.noteTags,
    database.linkTags,
    database.shipTags,
    async () => {
      await database.noteTags.where('tagId').equals(tagId).delete();
      await database.linkTags.where('tagId').equals(tagId).delete();
      await database.shipTags.where('tagId').equals(tagId).delete();
      await database.tags.delete(tagId);
    },
  );
}
