import { db } from '../../data/db';
import type { LinkModel, NoteModel, TagModel } from './models';
import { toLinkModel, toNoteModel, toTagModel } from './models';
import type { BackupStatus } from './logic';

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
 * Cheap aggregate over the 9 tables that hold user data (spec §17): whether any
 * data exists at all, and the most recent change timestamp across all of them.
 */
export async function collectBackupStatus(): Promise<BackupStatus> {
  const [notes, links, ships, scan, tracker, discovery, favorites, jobStatus, mapPins] =
    await Promise.all([
      db.notes.toArray(),
      db.links.toArray(),
      db.ships.toArray(),
      db.scanHistory.toArray(),
      db.trackerHistory.toArray(),
      db.discoveryHistory.toArray(),
      db.favorites.toArray(),
      db.jobStatus.toArray(),
      db.mapPins.toArray(),
    ]);

  const hasData =
    notes.length +
      links.length +
      ships.length +
      scan.length +
      tracker.length +
      discovery.length +
      favorites.length +
      jobStatus.length +
      mapPins.length >
    0;

  let lastChangedAt: number | null = null;
  const track = (value: number): void => {
    if (lastChangedAt === null || value > lastChangedAt) lastChangedAt = value;
  };
  for (const n of notes) track(n.updatedAt);
  for (const l of links) track(l.updatedAt);
  for (const s of ships) track(s.updatedAt);
  for (const h of scan) track(h.date);
  for (const h of tracker) track(h.date);
  for (const h of discovery) track(h.date);
  for (const f of favorites) track(f.createdAt);
  for (const j of jobStatus) track(j.updatedAt);
  for (const p of mapPins) track(p.updatedAt);

  return { hasData, lastChangedAt };
}
