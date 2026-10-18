import { afterEach, describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { filtersEqual, NONE, pristineFilter, type JobFilter } from './jobsLogic';
import {
  deserializeFilter,
  JOBS_FILTER_STORAGE_KEY,
  loadPersistedFilter,
  persistFilter,
  serializeFilter,
  type KeyValueStorage,
} from './jobsPersist';
import { useJobsFilterStore } from './jobsStore';

const busy: JobFilter = {
  ...pristineFilter(),
  query: 'not persisted',
  factions: new Set(['rep_mschf', 'rep_pearl']),
  place: 'zone:506:55',
  categories: new Set(['beginner']),
  rewards: new Set(['coin']),
  skill: NONE,
  shire: 'NorthSquire',
  noRepOnly: true,
  avoidRivals: new Set(['rep_mrtn']),
  noPrereqOnly: true,
  starredOnly: true,
  statuses: new Set<JobStatusValue>(['todo', 'done']),
  sort: 'repAsc',
};

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('serialize / deserialize', () => {
  it('restores every field but the search, sets included', () => {
    const back = deserializeFilter(serializeFilter(busy));
    expect(back.factions).toBeInstanceOf(Set);
    expect(filtersEqual(back, { ...busy, query: '' })).toBe(true);
  });

  it('corrupted JSON → pristine filter', () => {
    expect(filtersEqual(deserializeFilter('{not json'), pristineFilter())).toBe(true);
    expect(filtersEqual(deserializeFilter('null'), pristineFilter())).toBe(true);
    expect(filtersEqual(deserializeFilter('[1,2]'), pristineFilter())).toBe(true);
    expect(filtersEqual(deserializeFilter(null), pristineFilter())).toBe(true);
  });

  it('ignores the old (unversioned) format', () => {
    const old = JSON.stringify({ types: ['beginner'], rewards: ['coin'], starredOnly: true, sort: 'riskAsc' });
    expect(filtersEqual(deserializeFilter(old), pristineFilter())).toBe(true);
  });

  it('falls back field by field', () => {
    const raw = JSON.stringify({
      v: 2,
      factions: ['rep_hex', 42, null, ''],
      place: 'not a place',
      categories: 'beginner',
      rewards: ['coin'],
      skill: 7,
      shire: 'EastSquire',
      noRepOnly: 'yes',
      avoidRivals: ['rep_mrtn'],
      starredOnly: true,
      statuses: ['done', 'archived'],
      sort: 'skillAmtDesc',
      somethingElse: { deep: true },
    });
    const f = deserializeFilter(raw);
    expect([...f.factions]).toEqual(['rep_hex']);
    expect(f.place).toBeNull();
    expect(f.categories.size).toBe(0);
    expect([...f.rewards]).toEqual(['coin']);
    expect(f.skill).toBeNull();
    expect(f.shire).toBe('EastSquire');
    expect(f.noRepOnly).toBe(false);
    expect([...f.avoidRivals]).toEqual(['rep_mrtn']);
    expect(f.starredOnly).toBe(true);
    expect([...f.statuses]).toEqual(['done']);
    expect(f.sort).toBe('idAsc');
  });
});

describe('storage', () => {
  it('loads what was persisted', () => {
    const storage = memoryStorage();
    persistFilter(busy, storage);
    expect(storage.data[JOBS_FILTER_STORAGE_KEY]).toBeDefined();
    expect(filtersEqual(loadPersistedFilter(storage), { ...busy, query: '' })).toBe(true);
  });

  it('survives a storage that throws or is missing', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(filtersEqual(loadPersistedFilter(broken), pristineFilter())).toBe(true);
    expect(() => persistFilter(busy, broken)).not.toThrow();
    expect(filtersEqual(loadPersistedFilter(null), pristineFilter())).toBe(true);
  });
});

describe('jobs filter store', () => {
  afterEach(() => {
    useJobsFilterStore.getState().setFilter(pristineFilter());
  });

  it('writes every change (minus the search) to localStorage', () => {
    useJobsFilterStore.getState().setFilter(busy);
    const stored = deserializeFilter(localStorage.getItem(JOBS_FILTER_STORAGE_KEY));
    expect(filtersEqual(stored, { ...busy, query: '' })).toBe(true);
  });

  it('resetAll clears sheet, quick filters and search but keeps the sort', () => {
    useJobsFilterStore.getState().setFilter(busy);
    useJobsFilterStore.getState().resetAll();
    expect(filtersEqual(useJobsFilterStore.getState().filter, { ...pristineFilter(), sort: 'repAsc' })).toBe(true);
  });
});
