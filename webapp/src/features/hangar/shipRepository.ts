import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import {
  clearDeleted,
  db,
  deleteShipCascade,
  newUuid,
  pruneOrphanTags,
  restoreShipCascade,
  type DeletedRecord,
  type ShipRow,
  type TagRow,
} from '../../data/db';
import { draftToShipRow, rowToShipModel, sortShips, type ShipDraft, type ShipModel } from './shipModel';

/**
 * Hangar persistence (spec §12). Faithful port of the Drift repository onto
 * Dexie: a live ship list, atomic save with shared tag resolution + orphan
 * pruning, hull-only quick update, and cascade delete with Undo.
 */

// --- Live query hook --------------------------------------------------------

export type LiveState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; error: unknown };

/**
 * Subscribes to a Dexie `liveQuery`. Re-subscribes when `deps` change. Any DB
 * write re-emits, which is how every hangar view refreshes (spec §12.1).
 */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: readonly unknown[]): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({ status: 'loading' });
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({
      next: (data) => setState({ status: 'ok', data }),
      error: (error) => setState({ status: 'error', error }),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

// --- Queries ----------------------------------------------------------------

/** Builds the full, name-sorted ship list with resolved tags (spec §12.1). */
async function queryAllShips(): Promise<ShipModel[]> {
  const [rows, shipTags, tags] = await Promise.all([
    db.ships.toArray(),
    db.shipTags.toArray(),
    db.tags.toArray(),
  ]);
  const tagById = new Map<string, TagRow>(tags.map((t) => [t.id, t]));
  const tagsByShip = new Map<string, TagRow[]>();
  for (const st of shipTags) {
    const tag = tagById.get(st.tagId);
    if (tag === undefined) continue;
    const list = tagsByShip.get(st.shipId);
    if (list === undefined) tagsByShip.set(st.shipId, [tag]);
    else list.push(tag);
  }
  const models = rows.map((row) => rowToShipModel(row, tagsByShip.get(row.id) ?? []));
  return sortShips(models);
}

export function useShips(): LiveState<ShipModel[]> {
  return useLiveQuery(queryAllShips, []);
}

/** All tag display names app-wide - the suggestion pool (spec §6.3). */
export function useAllTags(): LiveState<TagRow[]> {
  return useLiveQuery(() => db.tags.orderBy('name').toArray(), []);
}

// --- Tag resolution / pruning (spec §12.2) ----------------------------------

/**
 * Resolves display names to tag ids inside a transaction: trim, skip blanks,
 * dedupe by lowercase within the batch, reuse an existing tag by lowercase
 * `name` else insert a new one. Returns ordered, unique tag ids.
 */
async function resolveTags(displayNames: string[]): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of displayNames) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = await db.tags.where('name').equals(key).first();
    if (existing !== undefined) {
      ids.push(existing.id);
    } else {
      const id = newUuid();
      await db.tags.put({ id, displayName: trimmed, name: key, colorHex: null });
      await clearDeleted(db, 'tags', [key]);
      ids.push(id);
    }
  }
  return ids;
}

// --- Mutations --------------------------------------------------------------

/**
 * Insert-or-update a ship and replace its tags atomically (spec §12.2).
 * Returns the (possibly newly generated) ship id.
 */
export async function saveShip(draft: ShipDraft, tagDisplayNames: string[]): Promise<string> {
  const now = Date.now();
  const id = draft.id === '' ? newUuid() : draft.id;
  await db.transaction(
    'rw',
    [db.ships, db.shipTags, db.tags, db.noteTags, db.linkTags, db.deletions],
    async () => {
      const existing = await db.ships.get(id);
      const createdAt = existing?.createdAt ?? now;
      if (existing === undefined) await clearDeleted(db, 'ships', [id]);
      await db.ships.put(draftToShipRow(draft, id, createdAt, now));

      const tagIds = await resolveTags(tagDisplayNames);
      await db.shipTags.where('shipId').equals(id).delete();
      for (const tagId of tagIds) await db.shipTags.put({ shipId: id, tagId });

      // Deletes every tag no join references any more (spec §12.2), remembering each.
      await pruneOrphanTags(db);
    },
  );
  return id;
}

/** Quick hull update from the list card - writes only hull + updatedAt (spec §12.3). */
export async function updateHull(id: string, hull: number): Promise<void> {
  await db.ships.update(id, { hull, updatedAt: Date.now() });
}

/**
 * Atomic delete: ship_tags rows, then the ship, then orphan tags (spec §12.3).
 * The deletion is remembered so an older backup can't bring the ship back.
 * Resolves to what `restoreShip` needs (undefined: no such ship).
 */
export function deleteShip(id: string): Promise<DeletedRecord<ShipRow> | undefined> {
  return deleteShipCascade(db, id);
}

/** Undo of deleteShip: the ship exactly as it was, with its tags. */
export function restoreShip(deleted: DeletedRecord<ShipRow>): Promise<void> {
  return restoreShipCascade(db, deleted);
}
