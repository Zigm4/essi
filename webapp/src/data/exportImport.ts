import { FormatException } from '../core/errors';
import { logError } from '../core/logging';
import {
  db,
  DELETION_TABLES,
  newUuid,
  zoneNoteKey,
  type DeletionRow,
  type DeletionTable,
  type FavoriteRow,
  type HistoryRow,
  type JobStatusRow,
  type JobStatusValue,
  type LinkRow,
  type LinkTagRow,
  type MapPinRow,
  type NoteRow,
  type NoteTagRow,
  type RemovedFavoriteRow,
  type ShipRow,
  type ShipTagRow,
  type TagRow,
  type UnderdeckDb,
} from './db';

/**
 * JSON export/import - format-compatible with the mobile app
 * (data-layer spec §4, formatVersion 1). Audit fixes honored:
 * - E1: only a written or shared file counts as a backup; a plain download is
 *   reported as such and the caller asks the user before markBackedUp.
 * - E5: an unparseable date on the newer-wins path falls back to epoch 0
 *   (must LOSE), while createdAt on the insert path falls back to now.
 * Known mobile quirks fixed here (flagged in the spec's open questions):
 * - favorites import whitelist includes 'map' and 'map_zone';
 * - jobStatus rows are guarded per-row instead of failing the whole file.
 * Web additions (still formatVersion 1, ignored by older importers):
 * - `removedFavorites` tombstones, and 'todo' jobStatus rows for resets, so an
 *   older backup can't undo a removal;
 * - `deletions` tombstones of notes, links, ships, tags, zone notes and history
 *   entries, for the same reason;
 * - mapPins merge per (mapId, zoneId): one note per zone, newest wins.
 */

const INVALID_FILE_MESSAGE = "This file isn't a valid ESSI export";
export const EXPORT_FILE_NAME = 'essi-export.json';

// Accepted `app` tokens on import. The product is now ESSI, but the export
// keeps writing the legacy 'Underdeck' wire token (see buildExportObject) for
// round-trip + mobile-import compatibility; files tagged 'ESSI' by future
// producers must import too. A missing `app` stays tolerated so older exports
// keep loading. These are wire-format tokens, not branding.
const ACCEPTED_APP_TOKENS = new Set(['Underdeck', 'ESSI']);

// ---------------------------------------------------------------------------
// Summary

export interface ImportSummary {
  notes: number;
  links: number;
  tags: number;
  ships: number;
  scanHistory: number;
  trackerHistory: number;
  discoveryHistory: number;
  favorites: number;
  jobStatus: number;
  mapPins: number;
}

export function emptyImportSummary(): ImportSummary {
  return {
    notes: 0,
    links: 0,
    tags: 0,
    ships: 0,
    scanHistory: 0,
    trackerHistory: 0,
    discoveryHistory: 0,
    favorites: 0,
    jobStatus: 0,
    mapPins: 0,
  };
}

export function isImportSummaryEmpty(s: ImportSummary): boolean {
  return (
    s.notes +
      s.links +
      s.tags +
      s.ships +
      s.scanHistory +
      s.trackerHistory +
      s.discoveryHistory +
      s.favorites +
      s.jobStatus +
      s.mapPins ===
    0
  );
}

/** SnackBar copy after import (data-layer spec §4.6, exact pluralizations). */
export function describeImportSummary(s: ImportSummary): string {
  if (isImportSummaryEmpty(s)) return 'Nothing imported.';
  const parts: string[] = [];
  const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
    `${n} ${n === 1 ? singular : pluralForm}`;
  if (s.notes > 0) parts.push(plural(s.notes, 'note'));
  if (s.links > 0) parts.push(plural(s.links, 'link'));
  if (s.tags > 0) parts.push(plural(s.tags, 'tag'));
  if (s.ships > 0) parts.push(plural(s.ships, 'ship'));
  if (s.scanHistory > 0) parts.push(plural(s.scanHistory, 'scan'));
  if (s.trackerHistory > 0) parts.push(plural(s.trackerHistory, 'track'));
  if (s.discoveryHistory > 0) parts.push(`${s.discoveryHistory} discoveries`);
  if (s.favorites > 0) parts.push(plural(s.favorites, 'favorite'));
  if (s.jobStatus > 0) parts.push(plural(s.jobStatus, 'job status', 'job statuses'));
  if (s.mapPins > 0) parts.push(plural(s.mapPins, 'map note'));
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Export

export interface ExportData {
  notes: NoteRow[];
  links: LinkRow[];
  tags: TagRow[];
  noteTags: NoteTagRow[];
  linkTags: LinkTagRow[];
  shipTags: ShipTagRow[];
  ships: ShipRow[];
  scanHistory: HistoryRow[];
  trackerHistory: HistoryRow[];
  discoveryHistory: HistoryRow[];
  favorites: FavoriteRow[];
  removedFavorites: RemovedFavoriteRow[];
  jobStatus: JobStatusRow[];
  mapPins: MapPinRow[];
  deletions: DeletionRow[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function historyToJson(h: HistoryRow): Record<string, unknown> {
  return { id: h.id, date: iso(h.date), mode: h.mode, payloadJson: h.payloadJson, errored: h.errored };
}

/** Builds the formatVersion-1 export object (data-layer spec §4.1). */
export function buildExportObject(data: ExportData, exportedAt: Date = new Date()): Record<string, unknown> {
  return {
    version: 1,
    // Compatibility wire token, NOT branding: kept as 'Underdeck' so exports
    // round-trip with the mobile app and older ESSI files. Import accepts both
    // this and 'ESSI' (see ACCEPTED_APP_TOKENS).
    app: 'Underdeck',
    exportedAt: exportedAt.toISOString(),
    data: {
      notes: data.notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: iso(n.createdAt),
        updatedAt: iso(n.updatedAt),
      })),
      links: data.links.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        note: l.note,
        createdAt: iso(l.createdAt),
        updatedAt: iso(l.updatedAt),
      })),
      tags: data.tags.map((t) => ({
        id: t.id,
        displayName: t.displayName,
        name: t.name,
        colorHex: t.colorHex,
      })),
      noteTags: data.noteTags.map((j) => ({ noteId: j.noteId, tagId: j.tagId })),
      linkTags: data.linkTags.map((j) => ({ linkId: j.linkId, tagId: j.tagId })),
      shipTags: data.shipTags.map((j) => ({ shipId: j.shipId, tagId: j.tagId })),
      // Ship field order matches the mobile exporter (byte-compat, not required).
      ships: data.ships.map((s) => ({
        id: s.id,
        name: s.name,
        modelKey: s.modelKey,
        customModelLabel: s.customModelLabel,
        registered: s.registered,
        locationKey: s.locationKey,
        customLocation: s.customLocation,
        locationZone: s.locationZone,
        locationSector: s.locationSector,
        locationSL: s.locationSL,
        hull: s.hull,
        pilotName: s.pilotName,
        gunnerName: s.gunnerName,
        cartographerName: s.cartographerName,
        prospectorName: s.prospectorName,
        signallerName: s.signallerName,
        technicianName: s.technicianName,
        sentryName: s.sentryName,
        fabricatorName: s.fabricatorName,
        medicName: s.medicName,
        quartermasterName: s.quartermasterName,
        chefName: s.chefName,
        alchemistName: s.alchemistName,
        note: s.note,
        createdAt: iso(s.createdAt),
        updatedAt: iso(s.updatedAt),
      })),
      scanHistory: data.scanHistory.map(historyToJson),
      trackerHistory: data.trackerHistory.map(historyToJson),
      discoveryHistory: data.discoveryHistory.map(historyToJson),
      favorites: data.favorites.map((f) => ({
        entityType: f.entityType,
        entityId: f.entityId,
        createdAt: iso(f.createdAt),
      })),
      removedFavorites: data.removedFavorites.map((f) => ({
        entityType: f.entityType,
        entityId: f.entityId,
        removedAt: iso(f.removedAt),
      })),
      jobStatus: data.jobStatus.map((j) => ({
        jobId: j.jobId,
        status: j.status,
        updatedAt: iso(j.updatedAt),
      })),
      mapPins: data.mapPins.map((p) => ({
        id: p.id,
        mapId: p.mapId,
        zoneId: p.zoneId,
        note: p.note,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      })),
      deletions: data.deletions.map((d) => ({
        table: d.table,
        key: d.key,
        deletedAt: iso(d.deletedAt),
      })),
    },
  };
}

export async function collectExportData(database: UnderdeckDb = db): Promise<ExportData> {
  return {
    notes: await database.notes.toArray(),
    links: await database.links.toArray(),
    tags: await database.tags.toArray(),
    noteTags: await database.noteTags.toArray(),
    linkTags: await database.linkTags.toArray(),
    shipTags: await database.shipTags.toArray(),
    ships: await database.ships.toArray(),
    scanHistory: await database.scanHistory.toArray(),
    trackerHistory: await database.trackerHistory.toArray(),
    discoveryHistory: await database.discoveryHistory.toArray(),
    favorites: await database.favorites.toArray(),
    removedFavorites: await database.removedFavorites.toArray(),
    jobStatus: await database.jobStatus.toArray(),
    mapPins: await database.mapPins.toArray(),
    deletions: await database.deletions.toArray(),
  };
}

// ---------------------------------------------------------------------------
// Saving the export file

/**
 * How an export ended. `saved` (the save dialog wrote the file) and `shared`
 * (the share sheet took it) are real evidence of a backup; `downloaded` is not -
 * the browser may ask where to save, or block it. `snapshotAt` is when the data
 * was read: pass it to markBackedUp so a change made while the user deals with
 * the dialog still counts as not backed up.
 */
export type ExportOutcome =
  | { kind: 'saved' | 'shared' | 'downloaded'; snapshotAt: number }
  | { kind: 'cancelled' };

/** The browser's ways to hand over the file, best evidence first (injectable for tests). */
export interface SaveTargets {
  /** Save dialog (File System Access). Rejects with AbortError on cancel; resolves to the writer. */
  pickSaveFile: ((fileName: string) => Promise<(text: string) => Promise<void>>) | null;
  /** OS share sheet with the file. Resolves once shared, rejects with AbortError on cancel. */
  shareFile: ((fileName: string, json: string) => Promise<void>) | null;
  download: (json: string, fileName: string) => void;
}

/** Revoking the object URL right after click() can kill a prompted or slow download. */
const DOWNLOAD_URL_LIFETIME_MS = 60_000;

/** Browser download: Blob → object URL → hidden anchor click (spec §8.3). */
export function downloadJson(json: string, fileName: string = EXPORT_FILE_NAME): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

interface SaveFilePickerHost {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

/**
 * True when the OS share sheet takes a JSON file on a touch device (iOS offers
 * "Save to Files"). Desktop share menus have no save target, so a download
 * serves better there.
 */
function canShareJsonFile(fileName: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return false;
  try {
    const probe = new File(['{}'], fileName, { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function browserSaveTargets(): SaveTargets {
  const host = window as SaveFilePickerHost;
  const showSaveFilePicker = host.showSaveFilePicker?.bind(window);
  return {
    pickSaveFile:
      showSaveFilePicker === undefined
        ? null
        : async (fileName) => {
            const handle = await showSaveFilePicker({
              suggestedName: fileName,
              types: [{ description: 'ESSI backup', accept: { 'application/json': ['.json'] } }],
            });
            return async (text) => {
              // Written to a swap file that close() commits: a failure leaves no half file.
              const writable = await handle.createWritable();
              await writable.write(text);
              await writable.close();
            };
          },
    shareFile: canShareJsonFile(EXPORT_FILE_NAME)
      ? (fileName, json) =>
          navigator.share({ files: [new File([json], fileName, { type: 'application/json' })] })
      : null,
    download: downloadJson,
  };
}

function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

/**
 * Full export. Prefers the save dialog (opened first, while the tap still
 * counts as a user gesture), then the share sheet, then a plain download.
 * Closing the dialog or sheet resolves `cancelled` and never throws; a dialog
 * or sheet the browser refuses falls through to the next way.
 */
export async function exportBackup(
  database: UnderdeckDb = db,
  targets: SaveTargets = browserSaveTargets(),
): Promise<ExportOutcome> {
  let snapshotAt = 0;
  const produce = async (): Promise<string> => {
    snapshotAt = Date.now();
    return JSON.stringify(buildExportObject(await collectExportData(database), new Date(snapshotAt)));
  };

  if (targets.pickSaveFile !== null) {
    let write: ((text: string) => Promise<void>) | null = null;
    try {
      write = await targets.pickSaveFile(EXPORT_FILE_NAME);
    } catch (e) {
      if (isAbortError(e)) return { kind: 'cancelled' };
      logError(e, 'data export: save dialog unavailable, trying the next way');
    }
    if (write !== null) {
      await write(await produce());
      return { kind: 'saved', snapshotAt };
    }
  }

  const json = await produce();
  if (targets.shareFile !== null) {
    try {
      await targets.shareFile(EXPORT_FILE_NAME, json);
      return { kind: 'shared', snapshotAt };
    } catch (e) {
      if (isAbortError(e)) return { kind: 'cancelled' };
      logError(e, 'data export: share sheet failed, downloading instead');
    }
  }
  targets.download(json, EXPORT_FILE_NAME);
  return { kind: 'downloaded', snapshotAt };
}

// ---------------------------------------------------------------------------
// Import target abstraction (lets tests run without IndexedDB)

export interface ImportStore {
  transaction: <T>(fn: () => Promise<T>) => Promise<T>;
  tagByName: (name: string) => Promise<TagRow | undefined>;
  tagById: (id: string) => Promise<TagRow | undefined>;
  /** insertOrIgnore semantics on the id key. */
  addTag: (tag: TagRow) => Promise<void>;
  getNote: (id: string) => Promise<NoteRow | undefined>;
  putNote: (row: NoteRow) => Promise<void>;
  getLink: (id: string) => Promise<LinkRow | undefined>;
  putLink: (row: LinkRow) => Promise<void>;
  getShip: (id: string) => Promise<ShipRow | undefined>;
  putShip: (row: ShipRow) => Promise<void>;
  putNoteTag: (row: NoteTagRow) => Promise<void>;
  putLinkTag: (row: LinkTagRow) => Promise<void>;
  putShipTag: (row: ShipTagRow) => Promise<void>;
  getScan: (id: string) => Promise<HistoryRow | undefined>;
  putScan: (row: HistoryRow) => Promise<void>;
  getTrack: (id: string) => Promise<HistoryRow | undefined>;
  putTrack: (row: HistoryRow) => Promise<void>;
  getDiscovery: (id: string) => Promise<HistoryRow | undefined>;
  putDiscovery: (row: HistoryRow) => Promise<void>;
  getFavorite: (entityType: string, entityId: string) => Promise<FavoriteRow | undefined>;
  putFavorite: (row: FavoriteRow) => Promise<void>;
  deleteFavorite: (entityType: string, entityId: string) => Promise<void>;
  getRemovedFavorite: (entityType: string, entityId: string) => Promise<RemovedFavoriteRow | undefined>;
  putRemovedFavorite: (row: RemovedFavoriteRow) => Promise<void>;
  deleteRemovedFavorite: (entityType: string, entityId: string) => Promise<void>;
  getJobStatus: (jobId: string) => Promise<JobStatusRow | undefined>;
  putJobStatus: (row: JobStatusRow) => Promise<void>;
  getMapPin: (id: string) => Promise<MapPinRow | undefined>;
  /** Every pin of one zone (normally at most one). */
  mapPinsForZone: (mapId: string, zoneId: string) => Promise<MapPinRow[]>;
  putMapPin: (row: MapPinRow) => Promise<void>;
  deleteMapPin: (id: string) => Promise<void>;
  /** Deletes the record and its tag relations; resolves to the ids of the tags it used. */
  deleteNote: (id: string) => Promise<string[]>;
  deleteLink: (id: string) => Promise<string[]>;
  deleteShip: (id: string) => Promise<string[]>;
  deleteScan: (id: string) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  deleteDiscovery: (id: string) => Promise<void>;
  /** Whether any note, link or ship uses the tag. */
  tagInUse: (tagId: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<void>;
  getDeletion: (table: DeletionTable, key: string) => Promise<DeletionRow | undefined>;
  putDeletion: (row: DeletionRow) => Promise<void>;
  deleteDeletion: (table: DeletionTable, key: string) => Promise<void>;
}

export function dexieImportStore(database: UnderdeckDb = db): ImportStore {
  return {
    // The scope must be an async function: only then does Dexie carry the
    // transaction across the merge's native awaits. A plain arrow loses it at
    // the first one - every later write then commits on its own and the import
    // ends in PrematureCommitError after a partial write.
    transaction: (fn) =>
      database.transaction(
        'rw',
        [
          database.notes,
          database.links,
          database.tags,
          database.noteTags,
          database.linkTags,
          database.shipTags,
          database.ships,
          database.scanHistory,
          database.trackerHistory,
          database.discoveryHistory,
          database.favorites,
          database.removedFavorites,
          database.jobStatus,
          database.mapPins,
          database.deletions,
        ],
        async () => fn(),
      ),
    tagByName: (name) => database.tags.where('name').equals(name).first(),
    tagById: (id) => database.tags.get(id),
    addTag: async (tag) => {
      try {
        await database.tags.add(tag);
      } catch {
        // insertOrIgnore - an id collision leaves the local row untouched.
      }
    },
    getNote: (id) => database.notes.get(id),
    putNote: async (row) => {
      await database.notes.put(row);
    },
    getLink: (id) => database.links.get(id),
    putLink: async (row) => {
      await database.links.put(row);
    },
    getShip: (id) => database.ships.get(id),
    putShip: async (row) => {
      await database.ships.put(row);
    },
    putNoteTag: async (row) => {
      await database.noteTags.put(row);
    },
    putLinkTag: async (row) => {
      await database.linkTags.put(row);
    },
    putShipTag: async (row) => {
      await database.shipTags.put(row);
    },
    getScan: (id) => database.scanHistory.get(id),
    putScan: async (row) => {
      await database.scanHistory.put(row);
    },
    getTrack: (id) => database.trackerHistory.get(id),
    putTrack: async (row) => {
      await database.trackerHistory.put(row);
    },
    getDiscovery: (id) => database.discoveryHistory.get(id),
    putDiscovery: async (row) => {
      await database.discoveryHistory.put(row);
    },
    getFavorite: (entityType, entityId) => database.favorites.get([entityType, entityId]),
    putFavorite: async (row) => {
      await database.favorites.put(row);
    },
    deleteFavorite: async (entityType, entityId) => {
      await database.favorites.delete([entityType, entityId]);
    },
    getRemovedFavorite: (entityType, entityId) => database.removedFavorites.get([entityType, entityId]),
    putRemovedFavorite: async (row) => {
      await database.removedFavorites.put(row);
    },
    deleteRemovedFavorite: async (entityType, entityId) => {
      await database.removedFavorites.delete([entityType, entityId]);
    },
    getJobStatus: (jobId) => database.jobStatus.get(jobId),
    putJobStatus: async (row) => {
      await database.jobStatus.put(row);
    },
    getMapPin: (id) => database.mapPins.get(id),
    mapPinsForZone: (mapId, zoneId) =>
      database.mapPins.where('[mapId+zoneId]').equals([mapId, zoneId]).toArray(),
    putMapPin: async (row) => {
      await database.mapPins.put(row);
    },
    deleteMapPin: async (id) => {
      await database.mapPins.delete(id);
    },
    deleteNote: async (id) => {
      const relations = database.noteTags.where('noteId').equals(id);
      const tagIds = (await relations.toArray()).map((r) => r.tagId);
      await relations.delete();
      await database.notes.delete(id);
      return tagIds;
    },
    deleteLink: async (id) => {
      const relations = database.linkTags.where('linkId').equals(id);
      const tagIds = (await relations.toArray()).map((r) => r.tagId);
      await relations.delete();
      await database.links.delete(id);
      return tagIds;
    },
    deleteShip: async (id) => {
      const relations = database.shipTags.where('shipId').equals(id);
      const tagIds = (await relations.toArray()).map((r) => r.tagId);
      await relations.delete();
      await database.ships.delete(id);
      return tagIds;
    },
    deleteScan: async (id) => {
      await database.scanHistory.delete(id);
    },
    deleteTrack: async (id) => {
      await database.trackerHistory.delete(id);
    },
    deleteDiscovery: async (id) => {
      await database.discoveryHistory.delete(id);
    },
    tagInUse: async (tagId) =>
      (await database.noteTags.where('tagId').equals(tagId).count()) > 0 ||
      (await database.linkTags.where('tagId').equals(tagId).count()) > 0 ||
      (await database.shipTags.where('tagId').equals(tagId).count()) > 0,
    deleteTag: async (id) => {
      await database.tags.delete(id);
    },
    getDeletion: (table, key) => database.deletions.get([table, key]),
    putDeletion: async (row) => {
      await database.deletions.put(row);
    },
    deleteDeletion: async (table, key) => {
      await database.deletions.delete([table, key]);
    },
  };
}

// ---------------------------------------------------------------------------
// Import - envelope validation + merge rules

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isDateString(v: unknown): boolean {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

/** createdAt on the INSERT path: a malformed date never aborts the file. */
function parseCreatedAtMs(v: unknown): number {
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

/** Newer-wins comparisons: an unreadable date must LOSE, never win (E5). */
function parseUpdatedAtMs(v: unknown): number {
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function sectionArray(data: Record<string, unknown>, key: string): unknown[] {
  const v = data[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new FormatException(INVALID_FILE_MESSAGE);
  return v;
}

/** Parses + validates the envelope, returning the `data` object. */
export function parseExportEnvelope(text: string): Record<string, unknown> {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new FormatException(INVALID_FILE_MESSAGE);
  }
  if (!isRecord(root)) throw new FormatException(INVALID_FILE_MESSAGE);
  const version = root['version'];
  if (!isInt(version) || version > 1) {
    throw new FormatException(`Unsupported export version: ${String(version)} (expected ≤ 1)`);
  }
  const app = root['app'];
  if (app !== undefined && app !== null && !(typeof app === 'string' && ACCEPTED_APP_TOKENS.has(app))) {
    throw new FormatException(INVALID_FILE_MESSAGE);
  }
  const data = root['data'];
  if (!isRecord(data)) throw new FormatException(INVALID_FILE_MESSAGE);
  return data;
}

// History payload validators - round-trip through the same shape checks the
// mobile fromJson paths enforce (data-layer spec §3), so a poisoned payload
// can never brick the history list later.

function validPlanetPosition(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (str(v['name']) === undefined || str(v['emoji']) === undefined) return false;
  if (!isInt(v['sector']) || !isInt(v['distanceSL'])) return false;
  if (!isDateString(v['timestamp'])) return false;
  const next = v['nextChange'];
  if (next !== undefined && next !== null) {
    if (!isRecord(next)) return false;
    if (!isDateString(next['date']) || !isInt(next['toSector'])) return false;
  }
  return true;
}

function validScanPayload(payloadJson: string): boolean {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payloadJson);
  } catch {
    return false;
  }
  if (!isRecord(decoded)) return false;
  const snapshots = decoded['snapshots'];
  if (!Array.isArray(snapshots)) return false;
  return snapshots.every(validPlanetPosition);
}

function validTrackerPayload(payloadJson: string): boolean {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payloadJson);
  } catch {
    return false;
  }
  if (!isRecord(decoded)) return false;
  return (
    str(decoded['mpcID']) !== undefined &&
    str(decoded['displayName']) !== undefined &&
    str(decoded['kind']) !== undefined &&
    isNum(decoded['xAU']) &&
    isNum(decoded['yAU']) &&
    isNum(decoded['zAU']) &&
    isInt(decoded['sector']) &&
    isNum(decoded['distanceAU']) &&
    isNum(decoded['slExact']) &&
    isNum(decoded['slRounded']) &&
    isInt(decoded['slFloor']) &&
    isDateString(decoded['timestamp'])
  );
}

function validDiscoveredObject(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (str(v['designation']) === undefined || str(v['fullName']) === undefined) return false;
  const optString = (x: unknown) => x === undefined || x === null || typeof x === 'string';
  const optNum = (x: unknown) => x === undefined || x === null || isNum(x);
  if (!optString(v['firstObs']) || !optString(v['lastObs'])) return false;
  if (v['isHazardous'] !== undefined && typeof v['isHazardous'] !== 'boolean') return false;
  if (!optNum(v['diameterMeters']) || !optNum(v['albedo'])) return false;
  return str(v['kind']) !== undefined;
}

function validDiscoveryPayload(payloadJson: string): boolean {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payloadJson);
  } catch {
    return false;
  }
  if (!isRecord(decoded)) return false;
  if (!isDateString(decoded['startDate']) || !isDateString(decoded['endDate'])) return false;
  const results = decoded['results'];
  if (!Array.isArray(results)) return false;
  return results.every(validDiscoveredObject);
}

// Whitelists

/** Includes 'map' and 'map_zone' - the mobile whitelist omission is fixed here. */
const VALID_FAVORITE_KINDS = new Set([
  'job',
  'kb_article',
  'fishing_zone',
  'tracked_object',
  'map',
  'map_zone',
]);
const MAX_FAVORITE_ENTITY_ID_LENGTH = 256;

const VALID_JOB_STATUSES = new Set(['todo', 'in_progress', 'done']);

const MAX_MAP_PIN_ID_LENGTH = 128;
const MAX_MAP_PIN_NOTE_LENGTH = 20_000;

const MAX_DELETION_KEY_LENGTH = 1024;

function isDeletionTable(v: string): v is DeletionTable {
  return (DELETION_TABLES as readonly string[]).includes(v);
}

/** (mapId, zoneId) of a zone note's tombstone key `mapId/zoneId`; map ids have no '/'. */
function zoneOfNoteKey(key: string): [string, string] | null {
  const slash = key.indexOf('/');
  if (slash <= 0 || slash === key.length - 1) return null;
  return [key.slice(0, slash), key.slice(slash + 1)];
}

/** A tombstone row of the file, or null (unknown table, bad key, unreadable date). */
function deletionOf(raw: Record<string, unknown>): DeletionRow | null {
  const table = str(raw['table']);
  const key = str(raw['key']);
  if (table === undefined || !isDeletionTable(table)) return null;
  if (key === undefined || key.length === 0 || key.length > MAX_DELETION_KEY_LENGTH) return null;
  if (table === 'mapPins' && zoneOfNoteKey(key) === null) return null;
  const deletedAt = parseUpdatedAtMs(raw['deletedAt']);
  if (deletedAt === 0) return null;
  return { table, key, deletedAt };
}

async function runImport(data: Record<string, unknown>, store: ImportStore): Promise<ImportSummary> {
  const summary = emptyImportSummary();

  // -- tags first ----------------------------------------------------------
  const tagRemap = new Map<string, string>();
  // Tags deleted here (tombstone by name) come back only with a note, link or
  // ship of this file that uses them (see ensureTagId).
  const deletedTags = new Map<string, TagRow>();
  for (const raw of sectionArray(data, 'tags')) {
    try {
      if (!isRecord(raw)) throw new TypeError('tag row is not an object');
      const importedId = str(raw['id']) ?? newUuid();
      const key = (str(raw['name']) ?? '').toLowerCase();
      const existing = await store.tagByName(key);
      if (existing !== undefined) {
        // Skip the insert but remap so join rows are preserved (H3).
        tagRemap.set(importedId, existing.id);
        continue;
      }
      const tag: TagRow = {
        id: importedId,
        displayName: str(raw['displayName']) ?? key,
        name: key,
        colorHex: strOrNull(raw['colorHex']),
      };
      if ((await store.getDeletion('tags', key)) !== undefined) {
        deletedTags.set(importedId, tag);
        continue;
      }
      await store.addTag(tag);
      tagRemap.set(importedId, importedId);
      summary.tags += 1;
    } catch (e) {
      logError(e, 'data import: skipped malformed tag row');
    }
  }

  const ensureTagId = async (id: string): Promise<string | null> => {
    const resolved = tagRemap.get(id) ?? id;
    if ((await store.tagById(resolved)) !== undefined) return resolved;
    // A tag deleted here that a record of this file uses again: re-created.
    const deleted = deletedTags.get(id);
    if (deleted === undefined) return null;
    deletedTags.delete(id);
    const named = await store.tagByName(deleted.name);
    if (named !== undefined) {
      tagRemap.set(id, named.id);
      return named.id;
    }
    await store.deleteDeletion('tags', deleted.name);
    await store.addTag(deleted);
    tagRemap.set(id, deleted.id);
    summary.tags += 1;
    return deleted.id;
  };

  // -- notes / links / ships (newer-wins) ----------------------------------
  const insertSimple = async <T extends { id: string; createdAt: number; updatedAt: number }>(
    table: DeletionTable,
    rows: unknown[],
    get: (id: string) => Promise<T | undefined>,
    put: (row: T) => Promise<void>,
    build: (raw: Record<string, unknown>, id: string, createdAt: number, updatedAt: number) => T,
  ): Promise<number> => {
    let count = 0;
    for (const raw of rows) {
      try {
        if (!isRecord(raw)) throw new TypeError('row is not an object');
        const id = str(raw['id']) ?? newUuid();
        const updatedAt = parseUpdatedAtMs(raw['updatedAt']);
        const existing = await get(id);
        if (existing !== undefined) {
          // Overwrite only when strictly newer; keep the original createdAt (F43).
          if (!(updatedAt > existing.updatedAt)) continue;
          await put(build(raw, id, existing.createdAt, updatedAt));
        } else {
          // Deleted here: only a version edited after the deletion comes back.
          const deletion = await store.getDeletion(table, id);
          if (deletion !== undefined) {
            if (!(updatedAt > deletion.deletedAt)) continue;
            await store.deleteDeletion(table, id);
          }
          await put(build(raw, id, parseCreatedAtMs(raw['createdAt']), updatedAt));
        }
        count += 1;
      } catch (e) {
        logError(e, 'data import: skipped malformed row');
      }
    }
    return count;
  };

  summary.notes = await insertSimple<NoteRow>(
    'notes',
    sectionArray(data, 'notes'),
    store.getNote,
    store.putNote,
    (raw, id, createdAt, updatedAt) => ({
      id,
      title: str(raw['title']) ?? '',
      body: str(raw['body']) ?? '',
      createdAt,
      updatedAt,
    }),
  );

  summary.links = await insertSimple<LinkRow>(
    'links',
    sectionArray(data, 'links'),
    store.getLink,
    store.putLink,
    (raw, id, createdAt, updatedAt) => ({
      id,
      title: str(raw['title']) ?? '',
      url: str(raw['url']) ?? '',
      note: str(raw['note']) ?? '',
      createdAt,
      updatedAt,
    }),
  );

  summary.ships = await insertSimple<ShipRow>(
    'ships',
    sectionArray(data, 'ships'),
    store.getShip,
    store.putShip,
    (raw, id, createdAt, updatedAt) => ({
      id,
      name: str(raw['name']) ?? '',
      modelKey: strOrNull(raw['modelKey']),
      customModelLabel: strOrNull(raw['customModelLabel']),
      registered: raw['registered'] === true,
      locationKey: strOrNull(raw['locationKey']),
      customLocation: strOrNull(raw['customLocation']),
      locationZone: intOrNull(raw['locationZone']),
      locationSector: strOrNull(raw['locationSector']),
      locationSL: intOrNull(raw['locationSL']),
      hull: intOrNull(raw['hull']),
      pilotName: strOrNull(raw['pilotName']),
      gunnerName: strOrNull(raw['gunnerName']),
      cartographerName: strOrNull(raw['cartographerName']),
      prospectorName: strOrNull(raw['prospectorName']),
      signallerName: strOrNull(raw['signallerName']),
      technicianName: strOrNull(raw['technicianName']),
      sentryName: strOrNull(raw['sentryName']),
      fabricatorName: strOrNull(raw['fabricatorName']),
      medicName: strOrNull(raw['medicName']),
      quartermasterName: strOrNull(raw['quartermasterName']),
      chefName: strOrNull(raw['chefName']),
      alchemistName: strOrNull(raw['alchemistName']),
      note: str(raw['note']) ?? '',
      createdAt,
      updatedAt,
    }),
  );

  // -- join tables (follow their parent: none for a record deleted here) ------
  const insertJoin = async (
    rows: unknown[],
    parentKey: string,
    parentExists: (id: string) => Promise<boolean>,
    put: (parentId: string, tagId: string) => Promise<void>,
  ): Promise<void> => {
    for (const raw of rows) {
      try {
        if (!isRecord(raw)) throw new TypeError('join row is not an object');
        const parentId = str(raw[parentKey]);
        const tagId = str(raw['tagId']);
        if (parentId === undefined || tagId === undefined) continue;
        if (!(await parentExists(parentId))) continue;
        const resolved = await ensureTagId(tagId);
        if (resolved === null) continue;
        await put(parentId, resolved);
      } catch (e) {
        logError(e, 'data import: skipped malformed join row');
      }
    }
  };

  await insertJoin(
    sectionArray(data, 'noteTags'),
    'noteId',
    async (id) => (await store.getNote(id)) !== undefined,
    (noteId, tagId) => store.putNoteTag({ noteId, tagId }),
  );
  await insertJoin(
    sectionArray(data, 'linkTags'),
    'linkId',
    async (id) => (await store.getLink(id)) !== undefined,
    (linkId, tagId) => store.putLinkTag({ linkId, tagId }),
  );
  await insertJoin(
    sectionArray(data, 'shipTags'),
    'shipId',
    async (id) => (await store.getShip(id)) !== undefined,
    (shipId, tagId) => store.putShipTag({ shipId, tagId }),
  );

  // -- histories (immutable: existing ids are skipped) ----------------------
  const insertHistory = async (
    table: DeletionTable,
    rows: unknown[],
    get: (id: string) => Promise<HistoryRow | undefined>,
    put: (row: HistoryRow) => Promise<void>,
    defaultMode: string,
    validPayload: (payloadJson: string) => boolean,
  ): Promise<number> => {
    let count = 0;
    for (const raw of rows) {
      try {
        if (!isRecord(raw)) throw new TypeError('history row is not an object');
        const id = str(raw['id']) ?? newUuid();
        const payloadJson = str(raw['payloadJson']) ?? '{}';
        if (!validPayload(payloadJson)) continue;
        if ((await get(id)) !== undefined) continue;
        // Deleted here. Entries never change, so the deletion always wins.
        if ((await store.getDeletion(table, id)) !== undefined) continue;
        await put({
          id,
          date: parseCreatedAtMs(raw['date']),
          mode: str(raw['mode']) ?? defaultMode,
          payloadJson,
          errored: raw['errored'] === true,
        });
        count += 1;
      } catch (e) {
        logError(e, 'data import: skipped malformed history row');
      }
    }
    return count;
  };

  summary.scanHistory = await insertHistory(
    'scanHistory',
    sectionArray(data, 'scanHistory'),
    store.getScan,
    store.putScan,
    'light',
    validScanPayload,
  );
  summary.trackerHistory = await insertHistory(
    'trackerHistory',
    sectionArray(data, 'trackerHistory'),
    store.getTrack,
    store.putTrack,
    'asteroid',
    validTrackerPayload,
  );
  summary.discoveryHistory = await insertHistory(
    'discoveryHistory',
    sectionArray(data, 'discoveryHistory'),
    store.getDiscovery,
    store.putDiscovery,
    'comet',
    validDiscoveryPayload,
  );

  // -- favorites -------------------------------------------------------------
  const favoriteKey = (raw: Record<string, unknown>): [string, string] | null => {
    const entityType = str(raw['entityType']);
    const entityId = str(raw['entityId']);
    if (entityType === undefined || !VALID_FAVORITE_KINDS.has(entityType)) return null;
    if (
      entityId === undefined ||
      entityId.length === 0 ||
      entityId.length > MAX_FAVORITE_ENTITY_ID_LENGTH
    ) {
      return null;
    }
    return [entityType, entityId];
  };

  for (const raw of sectionArray(data, 'favorites')) {
    try {
      if (!isRecord(raw)) throw new TypeError('favorite row is not an object');
      const key = favoriteKey(raw);
      if (key === null) continue;
      const [entityType, entityId] = key;
      if ((await store.getFavorite(entityType, entityId)) !== undefined) continue;
      // Un-starred here after this star was made: the removal wins (an
      // unreadable date counts as epoch 0, so it loses as well).
      const removed = await store.getRemovedFavorite(entityType, entityId);
      if (removed !== undefined) {
        if (!(parseUpdatedAtMs(raw['createdAt']) > removed.removedAt)) continue;
        await store.deleteRemovedFavorite(entityType, entityId);
      }
      await store.putFavorite({
        entityType,
        entityId,
        createdAt: parseCreatedAtMs(raw['createdAt']),
      });
      summary.favorites += 1;
    } catch (e) {
      logError(e, 'data import: skipped malformed favorite row');
    }
  }

  // Tombstones: a removal newer than the local star un-stars it (counted). It
  // is then kept, so a later import of an older file can't re-star either.
  for (const raw of sectionArray(data, 'removedFavorites')) {
    try {
      if (!isRecord(raw)) throw new TypeError('removed favorite row is not an object');
      const key = favoriteKey(raw);
      if (key === null) continue;
      const [entityType, entityId] = key;
      const removedAt = parseUpdatedAtMs(raw['removedAt']);
      if (removedAt === 0) continue;
      const live = await store.getFavorite(entityType, entityId);
      if (live !== undefined) {
        if (!(removedAt > live.createdAt)) continue;
        await store.deleteFavorite(entityType, entityId);
        summary.favorites += 1;
      }
      const existing = await store.getRemovedFavorite(entityType, entityId);
      if (existing !== undefined && !(removedAt > existing.removedAt)) continue;
      await store.putRemovedFavorite({ entityType, entityId, removedAt });
    } catch (e) {
      logError(e, 'data import: skipped malformed removed favorite row');
    }
  }

  // -- jobStatus (per-row guarded - deliberate fix over the mobile importer) --
  // A 'todo' row is a dated reset: newer-wins lets it undo an older 'done'.
  for (const raw of sectionArray(data, 'jobStatus')) {
    try {
      if (!isRecord(raw)) throw new TypeError('job status row is not an object');
      const jobId = str(raw['jobId']);
      const status = str(raw['status']);
      if (jobId === undefined || jobId.length === 0) continue;
      if (status === undefined || !VALID_JOB_STATUSES.has(status)) continue;
      const updatedAt = parseUpdatedAtMs(raw['updatedAt']);
      const existing = await store.getJobStatus(jobId);
      if (existing !== undefined && !(updatedAt > existing.updatedAt)) continue;
      await store.putJobStatus({ jobId, status: status as JobStatusValue, updatedAt });
      // Resetting a job that is already 'todo' here changes nothing visible.
      if (!(status === 'todo' && (existing?.status ?? 'todo') === 'todo')) summary.jobStatus += 1;
    } catch (e) {
      logError(e, 'data import: skipped malformed job status row');
    }
  }

  // -- mapPins (one note per zone: newest wins, whatever the ids) -------------
  for (const raw of sectionArray(data, 'mapPins')) {
    try {
      if (!isRecord(raw)) throw new TypeError('map pin row is not an object');
      const id = str(raw['id']);
      if (id === undefined || id.length === 0 || id.length > MAX_MAP_PIN_ID_LENGTH) continue;
      const mapId = str(raw['mapId']);
      const zoneId = str(raw['zoneId']);
      if (mapId === undefined || mapId.length === 0) continue;
      if (zoneId === undefined || zoneId.length === 0) continue;
      const note = (str(raw['note']) ?? '').slice(0, MAX_MAP_PIN_NOTE_LENGTH);
      const updatedAt = parseUpdatedAtMs(raw['updatedAt']);
      // The zone's note was deleted here: only one edited after that comes back.
      const zoneKey = zoneNoteKey(mapId, zoneId);
      const deletion = await store.getDeletion('mapPins', zoneKey);
      if (deletion !== undefined && !(updatedAt > deletion.deletedAt)) continue;
      const existing = await store.getMapPin(id);
      // Another device's note on the same zone has its own id: it competes too.
      const zonePins = await store.mapPinsForZone(mapId, zoneId);
      const rivals = existing === undefined ? zonePins : [existing, ...zonePins];
      if (rivals.some((p) => !(updatedAt > p.updatedAt))) continue;
      if (deletion !== undefined) await store.deleteDeletion('mapPins', zoneKey);
      for (const p of zonePins) {
        if (p.id !== id) await store.deleteMapPin(p.id);
      }
      await store.putMapPin({
        id,
        mapId,
        zoneId,
        note,
        createdAt: existing?.createdAt ?? parseCreatedAtMs(raw['createdAt']),
        updatedAt,
      });
      summary.mapPins += 1;
    } catch (e) {
      logError(e, 'data import: skipped malformed map pin row');
    }
  }

  // -- deletions (tombstones) -----------------------------------------------
  // A deletion newer than the local record removes it (counted like an import
  // of that record) and is kept, so an older file can't bring the record back
  // either. A record changed here after the deletion wins and the tombstone is
  // dropped: a record and its tombstone never coexist.
  const tagged = {
    notes: { get: store.getNote, remove: store.deleteNote },
    links: { get: store.getLink, remove: store.deleteLink },
    ships: { get: store.getShip, remove: store.deleteShip },
  };
  const histories = {
    scanHistory: { get: store.getScan, remove: store.deleteScan },
    trackerHistory: { get: store.getTrack, remove: store.deleteTrack },
    discoveryHistory: { get: store.getDiscovery, remove: store.deleteDiscovery },
  };
  /** Tags whose relations a removal dropped: pruned at the end if nothing uses them. */
  const lostTagIds = new Set<string>();

  /** Removes the local record unless it is at least as new (false: it stays). */
  const removeOlder = async ({ table, key, deletedAt }: DeletionRow): Promise<boolean> => {
    switch (table) {
      case 'notes':
      case 'links':
      case 'ships': {
        const live = await tagged[table].get(key);
        if (live === undefined) return true;
        if (!(deletedAt > live.updatedAt)) return false;
        for (const tagId of await tagged[table].remove(key)) lostTagIds.add(tagId);
        summary[table] += 1;
        return true;
      }
      case 'mapPins': {
        const zone = zoneOfNoteKey(key);
        if (zone === null) return false;
        const pins = await store.mapPinsForZone(zone[0], zone[1]);
        if (pins.some((p) => !(deletedAt > p.updatedAt))) return false;
        for (const p of pins) await store.deleteMapPin(p.id);
        summary.mapPins += pins.length;
        return true;
      }
      case 'scanHistory':
      case 'trackerHistory':
      case 'discoveryHistory':
        // Entries never change: the deletion always follows the entry.
        if ((await histories[table].get(key)) !== undefined) {
          await histories[table].remove(key);
          summary[table] += 1;
        }
        return true;
      case 'tags':
        return false;
    }
  };

  const keepDeletion = async (row: DeletionRow): Promise<void> => {
    const existing = await store.getDeletion(row.table, row.key);
    if (existing !== undefined && !(row.deletedAt > existing.deletedAt)) return;
    await store.putDeletion(row);
  };

  const tagDeletions: DeletionRow[] = [];
  for (const raw of sectionArray(data, 'deletions')) {
    try {
      if (!isRecord(raw)) throw new TypeError('deletion row is not an object');
      const row = deletionOf(raw);
      if (row === null) continue;
      if (row.table === 'tags') {
        tagDeletions.push(row);
        continue;
      }
      if (await removeOlder(row)) await keepDeletion(row);
    } catch (e) {
      logError(e, 'data import: skipped malformed deletion row');
    }
  }

  // Tags last, and they have no date: one still used here stays (its notes,
  // links and ships decide), an unused one goes. Not counted.
  for (const row of tagDeletions) {
    try {
      const live = await store.tagByName(row.key);
      if (live !== undefined) {
        if (await store.tagInUse(live.id)) continue;
        await store.deleteTag(live.id);
      }
      await keepDeletion(row);
    } catch (e) {
      logError(e, 'data import: skipped malformed deletion row');
    }
  }
  // A tag whose last note, link or ship this import removed goes too, as
  // after a delete here.
  for (const tagId of lostTagIds) {
    if (await store.tagInUse(tagId)) continue;
    const tag = await store.tagById(tagId);
    if (tag === undefined) continue;
    await store.deleteTag(tagId);
    await keepDeletion({ table: 'tags', key: tag.name, deletedAt: Date.now() });
  }

  return summary;
}

/** Parses and imports an export file's text. The whole merge runs in ONE transaction. */
export async function importJsonText(text: string, store: ImportStore = dexieImportStore()): Promise<ImportSummary> {
  const data = parseExportEnvelope(text);
  return store.transaction(() => runImport(data, store));
}

/** Opens a JSON file picker; resolves null on cancel. */
export function pickImportFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Full import flow from a user pick. Cancelling returns an all-zero summary. */
export async function importFromUserPick(store: ImportStore = dexieImportStore()): Promise<ImportSummary> {
  const file = await pickImportFile();
  if (file === null) return emptyImportSummary();
  const text = await file.text();
  return importJsonText(text, store);
}
