/**
 * Jobs filter persistence (spec §3.3): the whole filter except the search is
 * saved to localStorage so it survives a reload. Reading is defensive - any
 * malformed field falls back to its pristine value on its own, unknown fields
 * are ignored, and a payload from another format version is discarded.
 */

import type { JobStatusValue } from '../../../data/db';
import { isJobSort, JOB_STATUSES, pristineFilter, type JobFilter } from './jobsLogic';
import { parsePlaceKey } from './jobPlaces';

export const JOBS_FILTER_STORAGE_KEY = 'essi.jobs.filter.v2';
const FORMAT_VERSION = 2;

/** The slice of the Storage API this module needs (injectable for tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // Access can throw (privacy mode, blocked storage).
  }
}

export function serializeFilter(filter: JobFilter): string {
  return JSON.stringify({
    v: FORMAT_VERSION,
    factions: [...filter.factions],
    place: filter.place,
    categories: [...filter.categories],
    rewards: [...filter.rewards],
    skill: filter.skill,
    shire: filter.shire,
    noRepOnly: filter.noRepOnly,
    avoidRivals: [...filter.avoidRivals],
    noPrereqOnly: filter.noPrereqOnly,
    starredOnly: filter.starredOnly,
    statuses: [...filter.statuses],
    sort: filter.sort,
  });
}

function stringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0));
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Parses a stored payload; anything unusable → the pristine value, field by field. */
export function deserializeFilter(raw: string | null): JobFilter {
  const filter = pristineFilter();
  if (raw === null) return filter;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return filter;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return filter;
  const obj = data as Record<string, unknown>;
  if (obj.v !== FORMAT_VERSION) return filter;

  const place = nullableString(obj.place);
  const statuses = [...stringSet(obj.statuses)].filter((s): s is JobStatusValue =>
    (JOB_STATUSES as readonly string[]).includes(s),
  );
  return {
    ...filter,
    factions: stringSet(obj.factions),
    place: place !== null && parsePlaceKey(place) !== null ? place : null,
    categories: stringSet(obj.categories),
    rewards: stringSet(obj.rewards),
    skill: nullableString(obj.skill),
    shire: nullableString(obj.shire),
    noRepOnly: obj.noRepOnly === true,
    avoidRivals: stringSet(obj.avoidRivals),
    noPrereqOnly: obj.noPrereqOnly === true,
    starredOnly: obj.starredOnly === true,
    statuses: new Set(statuses),
    sort: isJobSort(obj.sort) ? obj.sort : filter.sort,
  };
}

export function loadPersistedFilter(storage: KeyValueStorage | null = browserStorage()): JobFilter {
  try {
    return deserializeFilter(storage?.getItem(JOBS_FILTER_STORAGE_KEY) ?? null);
  } catch {
    return pristineFilter();
  }
}

export function persistFilter(filter: JobFilter, storage: KeyValueStorage | null = browserStorage()): void {
  try {
    storage?.setItem(JOBS_FILTER_STORAGE_KEY, serializeFilter(filter));
  } catch {
    // Quota / blocked storage: the filter simply won't survive a reload.
  }
}
