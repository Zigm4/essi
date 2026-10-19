import { db, type UnderdeckDb } from '../../data/db';
import { readLocalChangeAt } from '../../data/localChanges';
import type { LinkModel, NoteModel, TagModel } from './models';
import { toLinkModel, toNoteModel, toTagModel } from './models';
import { backupStatusOf, type BackupStatus } from './logic';

/**
 * Read-side queries for Captures. Each function reads only from Dexie tables so
 * it can be wrapped in `liveQuery` - Dexie tracks every table touched and
 * re-emits whenever any of them changes (spec §20 stream mechanics).
 */

/** All tags, ordered by displayName with binary collation (spec §18.4). */
export async function loadTags(): Promise<TagModel[]> {
  const rows = await db.tags.toArray();
  return rows
    .map(toTagModel)
    .sort((a, b) => (a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0));
}

/** All notes, updatedAt DESC, with their joined tags (spec §18.4 / §20). */
export async function loadNotes(): Promise<NoteModel[]> {
  const [noteRows, noteTagRows, tagRows] = await Promise.all([
    db.notes.orderBy('updatedAt').reverse().toArray(),
    db.noteTags.toArray(),
    db.tags.toArray(),
  ]);
  const tagById = new Map<string, TagModel>(tagRows.map((t) => [t.id, toTagModel(t)]));
  const tagsByNote = new Map<string, TagModel[]>();
  for (const nt of noteTagRows) {
    const tag = tagById.get(nt.tagId);
    if (tag === undefined) continue;
    const list = tagsByNote.get(nt.noteId);
    if (list === undefined) tagsByNote.set(nt.noteId, [tag]);
    else list.push(tag);
  }
  return noteRows.map((row) => toNoteModel(row, tagsByNote.get(row.id) ?? []));
}

/** All links, updatedAt DESC, with their joined tags (spec §18.4 / §20). */
export async function loadLinks(): Promise<LinkModel[]> {
  const [linkRows, linkTagRows, tagRows] = await Promise.all([
    db.links.orderBy('updatedAt').reverse().toArray(),
    db.linkTags.toArray(),
    db.tags.toArray(),
  ]);
  const tagById = new Map<string, TagModel>(tagRows.map((t) => [t.id, toTagModel(t)]));
  const tagsByLink = new Map<string, TagModel[]>();
  for (const lt of linkTagRows) {
    const tag = tagById.get(lt.tagId);
    if (tag === undefined) continue;
    const list = tagsByLink.get(lt.linkId);
    if (list === undefined) tagsByLink.set(lt.linkId, [tag]);
    else list.push(tag);
  }
  return linkRows.map((row) => toLinkModel(row, tagsByLink.get(row.id) ?? []));
}

/**
 * Aggregate over the tables that hold user data (spec §17) plus the durable
 * local-change marker: whether any data exists at all, and the most recent
 * change (see backupStatusOf). The marker is not reactive, but the writes that
 * bump it touch these tables (tag and join rows change with their note, link
 * or ship), so the live query re-runs and reads it.
 */
export async function collectBackupStatus(
  database: UnderdeckDb = db,
  localChangeAt: () => number | null = readLocalChangeAt,
): Promise<BackupStatus> {
  const [
    notes,
    links,
    ships,
    scanHistory,
    trackerHistory,
    discoveryHistory,
    favorites,
    removedFavorites,
    jobStatus,
    mapPins,
  ] = await Promise.all([
    database.notes.toArray(),
    database.links.toArray(),
    database.ships.toArray(),
    database.scanHistory.toArray(),
    database.trackerHistory.toArray(),
    database.discoveryHistory.toArray(),
    database.favorites.toArray(),
    database.removedFavorites.toArray(),
    database.jobStatus.toArray(),
    database.mapPins.toArray(),
  ]);
  return backupStatusOf({
    notes,
    links,
    ships,
    scanHistory,
    trackerHistory,
    discoveryHistory,
    favorites,
    removedFavorites,
    jobStatus,
    mapPins,
    localChangeAt: localChangeAt(),
  });
}
