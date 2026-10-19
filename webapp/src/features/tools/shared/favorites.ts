import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, toggleFavoriteRow, type FavoriteKindValue } from '../../../data/db';

/**
 * Reactive membership set of favorite entity-ids for one kind (`job`,
 * `fishing_zone`, …). Backed by a single Dexie `liveQuery` subscription so a
 * 371-row list needs one live query, not one per card. Ids are the stringified
 * entity ids used by the Favorites table.
 */
export function useFavoriteSet(kind: FavoriteKindValue): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sub = liveQuery(() =>
      db.favorites.where('entityType').equals(kind).toArray(),
    ).subscribe({
      next: (rows) => setIds(new Set(rows.map((r) => r.entityId))),
      error: () => setIds(new Set()),
    });
    return () => sub.unsubscribe();
  }, [kind]);
  return ids;
}

/**
 * Toggles a favorite row for (kind, id); un-starring leaves a tombstone (see
 * toggleFavoriteRow). Throws on DB failure (caller toasts).
 */
export async function toggleFavorite(kind: FavoriteKindValue, id: string): Promise<void> {
  await toggleFavoriteRow(db, kind, id);
}
