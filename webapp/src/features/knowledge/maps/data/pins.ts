/**
 * Per-zone user notes ("pins") persisted to Dexie `mapPins` (maps spec §8.2,
 * §16.3). One pin per (mapId, zoneId); a trimmed-empty note deletes the pin.
 * Pins are deliberately NOT foreign-keyed — a pin outlives a temporarily
 * uninstalled pack.
 */

import { db, newUuid, type MapPinRow } from '../../../../data/db';
import { MAX_PIN_NOTE_LENGTH } from '../model/limits';

export async function listPinsForMap(mapId: string): Promise<MapPinRow[]> {
  const rows = await db.mapPins.where('[mapId+zoneId]').between([mapId, ''], [mapId, '￿']).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listAllPins(): Promise<MapPinRow[]> {
  const rows = await db.mapPins.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPin(mapId: string, zoneId: string): Promise<MapPinRow | undefined> {
  return db.mapPins.where('[mapId+zoneId]').equals([mapId, zoneId]).first();
}

export async function countPinsForMap(mapId: string): Promise<number> {
  return db.mapPins.where('[mapId+zoneId]').between([mapId, ''], [mapId, '￿']).count();
}

/**
 * Upsert a pin. A trimmed-empty note deletes any existing pin; otherwise a new
 * pin is created (uuid v4, createdAt=updatedAt=now) or the existing one is
 * updated in place. Note is capped at the import cap so round-trips never
 * truncate.
 */
export async function savePin(mapId: string, zoneId: string, note: string): Promise<void> {
  const trimmed = note.trim();
  const existing = await getPin(mapId, zoneId);
  if (trimmed.length === 0) {
    if (existing !== undefined) await db.mapPins.delete(existing.id);
    return;
  }
  const capped = trimmed.slice(0, MAX_PIN_NOTE_LENGTH);
  const now = Date.now();
  if (existing !== undefined) {
    await db.mapPins.update(existing.id, { note: capped, updatedAt: now });
  } else {
    await db.mapPins.put({
      id: newUuid(),
      mapId,
      zoneId,
      note: capped,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deletePin(id: string): Promise<void> {
  await db.mapPins.delete(id);
}
