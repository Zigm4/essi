/**
 * Per-zone user notes ("pins") persisted to Dexie `mapPins` (maps spec §8.2,
 * §16.3). One pin per (mapId, zoneId); a trimmed-empty note deletes the pin.
 * Pins are deliberately NOT foreign-keyed - a pin outlives a temporarily
 * uninstalled pack. A deleted note leaves a tombstone for its zone, so an older
 * backup can't bring it back (data-layer §2.3); a new note on the zone clears it.
 */

import {
  clearDeleted,
  db,
  markDeleted,
  newUuid,
  zoneNoteKey,
  type MapPinRow,
} from '../../../../data/db';
import { MAX_PIN_NOTE_LENGTH } from '../model/limits';

export async function listPinsForMap(mapId: string): Promise<MapPinRow[]> {
  const rows = await db.mapPins.where('[mapId+zoneId]').between([mapId, ''], [mapId, '￿']).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listAllPins(): Promise<MapPinRow[]> {
  const rows = await db.mapPins.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The zone's note; the most recently edited one should a duplicate slip through. */
export async function getPin(mapId: string, zoneId: string): Promise<MapPinRow | undefined> {
  const rows = await db.mapPins.where('[mapId+zoneId]').equals([mapId, zoneId]).toArray();
  return rows.reduce<MapPinRow | undefined>(
    (newest, row) => (newest === undefined || row.updatedAt > newest.updatedAt ? row : newest),
    undefined,
  );
}

export async function countPinsForMap(mapId: string): Promise<number> {
  return db.mapPins.where('[mapId+zoneId]').between([mapId, ''], [mapId, '￿']).count();
}

/**
 * Upsert a pin. A trimmed-empty note deletes any existing pin; otherwise a new
 * pin is created (uuid v4, createdAt=updatedAt=now) or the existing one is
 * updated in place. Note is capped at the import cap so round-trips never
 * truncate. One transaction, so two quick saves can't both create a pin.
 */
export async function savePin(mapId: string, zoneId: string, note: string): Promise<void> {
  const trimmed = note.trim();
  await db.transaction('rw', db.mapPins, db.deletions, async () => {
    const existing = await getPin(mapId, zoneId);
    if (trimmed.length === 0) {
      if (existing !== undefined) {
        await db.mapPins.delete(existing.id);
        await markDeleted(db, 'mapPins', [zoneNoteKey(mapId, zoneId)]);
      }
      return;
    }
    const capped = trimmed.slice(0, MAX_PIN_NOTE_LENGTH);
    const now = Date.now();
    if (existing !== undefined) {
      await db.mapPins.update(existing.id, { note: capped, updatedAt: now });
    } else {
      await clearDeleted(db, 'mapPins', [zoneNoteKey(mapId, zoneId)]);
      await db.mapPins.put({
        id: newUuid(),
        mapId,
        zoneId,
        note: capped,
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

export async function deletePin(id: string): Promise<void> {
  await db.transaction('rw', db.mapPins, db.deletions, async () => {
    const pin = await db.mapPins.get(id);
    if (pin === undefined) return;
    await db.mapPins.delete(id);
    await markDeleted(db, 'mapPins', [zoneNoteKey(pin.mapId, pin.zoneId)]);
  });
}
