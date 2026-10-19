import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, HISTORY_LIMIT, newUuid, type HistoryRow } from '../../../data/db';
import {
  planetPositionFromJson,
  planetPositionToJson,
  trackerResultFromJson,
  trackerResultToJson,
  type PlanetPosition,
  type ScanMode,
  type TrackerResult,
} from './models';
import {
  discoveredObjectFromJson,
  discoveredObjectToJson,
  type DiscoveredObject,
  type ObjectKind,
} from './sbdb';

/**
 * Shared history feature (tools-live spec §3). Three identical tables
 * (scanHistory / trackerHistory / discoveryHistory) with the HistoryRow shape.
 * Lists stream newest-first, capped at 100 rows; payloads decode lazily so a
 * single corrupt entry degrades only its own row.
 */

export type HistoryKind = 'scan' | 'tracker' | 'discovery';

function tableFor(kind: HistoryKind) {
  switch (kind) {
    case 'scan':
      return db.scanHistory;
    case 'tracker':
      return db.trackerHistory;
    case 'discovery':
      return db.discoveryHistory;
  }
}

function isWellFormedRow(row: unknown): row is HistoryRow {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.date === 'number' && typeof r.payloadJson === 'string';
}

export type HistoryFeed =
  | { status: 'loading' }
  | { status: 'data'; rows: HistoryRow[] }
  | { status: 'error' };

/** Reactive newest-first history feed (re-emits on any table mutation). */
export function useHistory(kind: HistoryKind): HistoryFeed {
  const [feed, setFeed] = useState<HistoryFeed>({ status: 'loading' });
  useEffect(() => {
    setFeed({ status: 'loading' });
    const table = tableFor(kind);
    const sub = liveQuery(() =>
      table.orderBy('date').reverse().limit(HISTORY_LIMIT).toArray(),
    ).subscribe({
      next: (rows) => setFeed({ status: 'data', rows: rows.filter(isWellFormedRow) }),
      error: () => setFeed({ status: 'error' }),
    });
    return () => sub.unsubscribe();
  }, [kind]);
  return feed;
}

// --- Writes ------------------------------------------------------------------

/** Discoveries rows keep this many objects (a pre-1900 search can return ~50 000). */
export const DISCOVERY_HISTORY_MAX_OBJECTS = 200;

/** Drops rows past the newest HISTORY_LIMIT (the list never shows them, but backups did). */
async function purgeOld(kind: HistoryKind): Promise<void> {
  const table = tableFor(kind);
  const stale = await table.orderBy('date').reverse().offset(HISTORY_LIMIT).primaryKeys();
  if (stale.length > 0) await table.bulkDelete(stale);
}

export async function saveScanHistory(
  mode: ScanMode,
  snapshots: PlanetPosition[],
  errored: boolean,
): Promise<void> {
  await db.scanHistory.put({
    id: newUuid(),
    date: Date.now(),
    mode,
    payloadJson: JSON.stringify({ snapshots: snapshots.map(planetPositionToJson) }),
    errored,
  });
  await purgeOld('scan');
}

export async function saveTrackerHistory(result: TrackerResult): Promise<void> {
  await db.trackerHistory.put({
    id: newUuid(),
    date: Date.now(),
    mode: result.kind,
    payloadJson: JSON.stringify(trackerResultToJson(result)),
    errored: false,
  });
  await purgeOld('tracker');
}

export async function saveDiscoveryHistory(
  kind: ObjectKind,
  startDate: Date,
  endDate: Date,
  results: DiscoveredObject[],
): Promise<void> {
  await db.discoveryHistory.put({
    id: newUuid(),
    date: Date.now(),
    mode: kind,
    payloadJson: JSON.stringify({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      total: results.length,
      results: results.slice(0, DISCOVERY_HISTORY_MAX_OBJECTS).map(discoveredObjectToJson),
    }),
    errored: false,
  });
  await purgeOld('discovery');
}

/** Deletes one row and returns it, so an Undo can put it back. */
export async function deleteHistoryRow(kind: HistoryKind, id: string): Promise<HistoryRow | undefined> {
  const table = tableFor(kind);
  const row = await table.get(id);
  await table.delete(id);
  return row;
}

export async function restoreHistoryRow(kind: HistoryKind, row: HistoryRow): Promise<void> {
  await tableFor(kind).put(row);
}

export async function clearHistory(kind: HistoryKind): Promise<void> {
  await tableFor(kind).clear();
}

// --- Lazy payload decoders (throw on corrupt payloads) -----------------------

export interface ScanEntry {
  mode: ScanMode;
  snapshots: PlanetPosition[];
}

export function decodeScanEntry(row: HistoryRow): ScanEntry {
  const parsed = JSON.parse(row.payloadJson) as unknown;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('corrupt scan payload');
  const snaps = (parsed as Record<string, unknown>).snapshots;
  if (!Array.isArray(snaps)) throw new Error('corrupt scan payload');
  return {
    mode: row.mode === 'full' ? 'full' : 'light',
    snapshots: snaps.map(planetPositionFromJson),
  };
}

export function decodeTrackerEntry(row: HistoryRow): TrackerResult {
  return trackerResultFromJson(JSON.parse(row.payloadJson));
}

export interface DiscoveryEntry {
  kind: ObjectKind;
  startDate: Date;
  endDate: Date;
  /** The saved objects (at most DISCOVERY_HISTORY_MAX_OBJECTS). */
  results: DiscoveredObject[];
  /** How many objects the search found (≥ results.length). */
  total: number;
}

export function decodeDiscoveryEntry(row: HistoryRow): DiscoveryEntry {
  const parsed = JSON.parse(row.payloadJson) as unknown;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('corrupt discovery payload');
  const o = parsed as Record<string, unknown>;
  const rawResults = Array.isArray(o.results) ? o.results : [];
  const results: DiscoveredObject[] = [];
  for (const r of rawResults) {
    const parsedObj = discoveredObjectFromJson(r);
    if (parsedObj !== null) results.push(parsedObj);
  }
  return {
    kind: row.mode === 'comet' ? 'comet' : 'asteroid',
    startDate: new Date(typeof o.startDate === 'string' ? o.startDate : NaN),
    endDate: new Date(typeof o.endDate === 'string' ? o.endDate : NaN),
    results,
    total: typeof o.total === 'number' && o.total >= results.length ? o.total : results.length,
  };
}
