import { db, newUuid, type TagRow } from '../../data/db';
import { dedupeTagInputs } from './logic';
import type { LinkModel, NoteModel } from './models';
import { toLinkModel, toNoteModel, toTagModel } from './models';

/**
 * Write-side repository for Captures. Every mutation runs inside a single Dexie
 * transaction (atomicity, spec §18.2 "F45") and prunes orphan tags afterwards
 * (spec §18.3 "R9a"). Title/body/url/note are persisted exactly as typed - no
 * trimming (spec §8/§9/§18.2).
 */

/** Tables every captures mutation touches (entity + all join + tags for prune). */
const MUTATION_TABLES = [db.notes, db.links, db.noteTags, db.linkTags, db.shipTags, db.tags];

/**
 * `_resolveTags` (spec §18.1). Must run inside an existing rw transaction so
 * new tag inserts are atomic with the rest of the save. Reuses existing rows by
 * lowercase `name` (first spelling wins); inserts new rows for unseen keys.
 * Returns the resolved rows ordered as typed.
 */
async function resolveTagsTx(displayNames: readonly string[]): Promise<TagRow[]> {
  const existing = await db.tags.toArray();
  const byKey = new Map<string, TagRow>(existing.map((row) => [row.name, row]));
  const out: TagRow[] = [];
  for (const displayName of dedupeTagInputs(displayNames)) {
    const key = displayName.toLowerCase();
    const found = byKey.get(key);
    if (found !== undefined) {
      out.push(found);
      continue;
    }
    const created: TagRow = { id: newUuid(), displayName, name: key, colorHex: null };
    await db.tags.add(created);
    byKey.set(key, created);
    out.push(created);
  }
  return out;
}

/**
 * `pruneOrphanTags` (spec §18.3): delete every tag no note/link/ship references.
 * Runs inside the mutation transaction.
 */
async function pruneOrphanTagsTx(): Promise<void> {
  const [tags, noteTags, linkTags, shipTags] = await Promise.all([
    db.tags.toArray(),
    db.noteTags.toArray(),
    db.linkTags.toArray(),
    db.shipTags.toArray(),
  ]);
  const used = new Set<string>();
  for (const r of noteTags) used.add(r.tagId);
  for (const r of linkTags) used.add(r.tagId);
  for (const r of shipTags) used.add(r.tagId);
  const orphanIds = tags.filter((t) => !used.has(t.id)).map((t) => t.id);
  if (orphanIds.length > 0) await db.tags.bulkDelete(orphanIds);
}

export interface SaveNoteInput {
  id?: string;
  title: string;
  body: string;
  tagDisplayNames: readonly string[];
}

/** `saveNote` (spec §18.2). Creates or updates atomically, then prunes. */
export async function saveNote(input: SaveNoteInput): Promise<NoteModel> {
  const now = Date.now();
  const noteId = input.id ?? newUuid();
  return db.transaction('rw', MUTATION_TABLES, async () => {
    const resolved = await resolveTagsTx(input.tagDisplayNames);
    const existing = await db.notes.get(noteId);
    if (existing === undefined) {
      await db.notes.add({
        id: noteId,
        title: input.title,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db.notes.update(noteId, {
        title: input.title,
        body: input.body,
        updatedAt: now,
      });
    }
    await db.noteTags.where('noteId').equals(noteId).delete();
    if (resolved.length > 0) {
      await db.noteTags.bulkAdd(resolved.map((t) => ({ noteId, tagId: t.id })));
    }
    await pruneOrphanTagsTx();
    const saved = await db.notes.get(noteId);
    const createdAt = saved?.createdAt ?? now;
    return toNoteModel(
      { id: noteId, title: input.title, body: input.body, createdAt, updatedAt: now },
      resolved.map(toTagModel),
    );
  });
}

export interface SaveLinkInput {
  id?: string;
  title: string;
  url: string;
  note: string;
  tagDisplayNames: readonly string[];
}

/** `saveLink` (spec §18.2). Same shape as saveNote with three text columns. */
export async function saveLink(input: SaveLinkInput): Promise<LinkModel> {
  const now = Date.now();
  const linkId = input.id ?? newUuid();
  return db.transaction('rw', MUTATION_TABLES, async () => {
    const resolved = await resolveTagsTx(input.tagDisplayNames);
    const existing = await db.links.get(linkId);
    if (existing === undefined) {
      await db.links.add({
        id: linkId,
        title: input.title,
        url: input.url,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db.links.update(linkId, {
        title: input.title,
        url: input.url,
        note: input.note,
        updatedAt: now,
      });
    }
    await db.linkTags.where('linkId').equals(linkId).delete();
    if (resolved.length > 0) {
      await db.linkTags.bulkAdd(resolved.map((t) => ({ linkId, tagId: t.id })));
    }
    await pruneOrphanTagsTx();
    const saved = await db.links.get(linkId);
    const createdAt = saved?.createdAt ?? now;
    return toLinkModel(
      {
        id: linkId,
        title: input.title,
        url: input.url,
        note: input.note,
        createdAt,
        updatedAt: now,
      },
      resolved.map(toTagModel),
    );
  });
}

/** `deleteNote` (spec §18.2): drop join rows + the note, then prune. */
export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', MUTATION_TABLES, async () => {
    await db.noteTags.where('noteId').equals(id).delete();
    await db.notes.delete(id);
    await pruneOrphanTagsTx();
  });
}

/** `deleteLink` (spec §18.2): drop join rows + the link, then prune. */
export async function deleteLink(id: string): Promise<void> {
  await db.transaction('rw', MUTATION_TABLES, async () => {
    await db.linkTags.where('linkId').equals(id).delete();
    await db.links.delete(id);
    await pruneOrphanTagsTx();
  });
}
