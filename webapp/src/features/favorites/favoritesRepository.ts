import { liveQuery, type Observable } from 'dexie';
import { db, type FavoriteKindValue } from '../../data/db';

/**
 * Generic star / pin / bookmark store shared across the whole app
 * (knowledge spec §10). Persisted to the Dexie `favorites` table with the
 * compound primary key `[entityType+entityId]`, so an entity is favorited at
 * most once. This area only ever writes `kb_article` rows, but the store is
 * shared (jobs star, fishing-zone star, tracker pin, map / zone favorites).
 *
 * All reads are live: `liveQuery` re-emits whenever the `favorites` table
 * changes, so toggling from anywhere updates every observer.
 */

async function idsForKind(kind: FavoriteKindValue): Promise<Set<string>> {
  const rows = await db.favorites.where('entityType').equals(kind).toArray();
  return new Set(rows.map((row) => row.entityId));
}

export const favoritesRepository = {
  /** Live set of favorited ids for one kind. */
  watchIds(kind: FavoriteKindValue): Observable<Set<string>> {
    return liveQuery(() => idsForKind(kind));
  },

  /** Live boolean for a single entity. */
  watchIsFavorite(kind: FavoriteKindValue, id: string): Observable<boolean> {
    return liveQuery(async () => (await db.favorites.get([kind, id])) !== undefined);
  },

  /** Plain querier for `useLiveQuery` consumers (FavoriteButton, jobs filter). */
  getIds(kind: FavoriteKindValue): Promise<Set<string>> {
    return idsForKind(kind);
  },

  async isFavorite(kind: FavoriteKindValue, id: string): Promise<boolean> {
    return (await db.favorites.get([kind, id])) !== undefined;
  },

  /**
   * Delete the row if present, else insert it (createdAt = now).
   * Returns the new favorite state (`true` = now favorited).
   */
  async toggle(kind: FavoriteKindValue, id: string): Promise<boolean> {
    return db.transaction('rw', db.favorites, async () => {
      const existing = await db.favorites.get([kind, id]);
      if (existing !== undefined) {
        await db.favorites.delete([kind, id]);
        return false;
      }
      await db.favorites.put({ entityType: kind, entityId: id, createdAt: Date.now() });
      return true;
    });
  },
};
