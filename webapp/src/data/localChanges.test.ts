import type { DBCore, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreTransaction } from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, duplicatePinIds, USER_DATA_TABLES, type MapPinRow } from './db';
import { localChangesMiddleware, markLocalChange, readLocalChangeAt } from './localChanges';

const trans = {} as DBCoreTransaction;

/** A DBCore whose mutate answers with `numFailures` failed operations. */
function fakeCore(numFailures = 0): DBCore {
  const response: DBCoreMutateResponse = { numFailures, failures: {}, lastResult: undefined };
  return {
    stack: 'dbcore',
    table: (name: string) => ({ name, mutate: () => Promise.resolve(response) }),
  } as unknown as DBCore;
}

function wrapped(onChange: () => void, numFailures = 0): DBCore {
  const middleware = localChangesMiddleware(new Set(['notes']), onChange);
  return middleware.create(fakeCore(numFailures)) as DBCore;
}

const put: DBCoreMutateRequest = { type: 'put', trans, values: [{ id: 'n1' }] };

describe('local-change marker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is stored next to lastBackupAt and never moves backwards', () => {
    expect(readLocalChangeAt()).toBeNull();
    markLocalChange(2_000);
    expect(localStorage.getItem('underdeck.settings.lastLocalChangeAt')).toBe('2000');
    markLocalChange(1_000); // clock stepped back
    expect(readLocalChangeAt()).toBe(2_000);
    markLocalChange(3_000);
    expect(readLocalChangeAt()).toBe(3_000);
  });
});

describe('localChangesMiddleware', () => {
  it('fires after writes and deletions on tracked tables, clears included', async () => {
    const onChange = vi.fn();
    const core = wrapped(onChange);
    await core.table('notes').mutate(put);
    await core.table('notes').mutate({ type: 'delete', trans, keys: ['n1'] });
    await core.table('notes').mutate({ type: 'deleteRange', trans, range: {} as never });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('ignores caches, empty deletes and writes that all failed', async () => {
    const onChange = vi.fn();
    await wrapped(onChange).table('mapBlobs').mutate(put);
    await wrapped(onChange).table('notes').mutate({ type: 'delete', trans, keys: [] });
    await wrapped(onChange, 1).table('notes').mutate(put);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('USER_DATA_TABLES', () => {
  it('covers every table but the rebuildable map pack index and blob cache', () => {
    const caches = ['mapPacks', 'mapPackFiles', 'mapBlobs'];
    const expected = db.tables.map((t) => t.name).filter((name) => !caches.includes(name));
    expect([...USER_DATA_TABLES].sort()).toEqual(expected.sort());
  });
});

describe('duplicatePinIds', () => {
  const pin = (id: string, zoneId: string, updatedAt: number): MapPinRow => ({
    id,
    mapId: 'mars',
    zoneId,
    note: id,
    createdAt: 0,
    updatedAt,
  });

  it('keeps the most recently edited note of each zone', () => {
    const rows = [pin('a', 'z1', 10), pin('b', 'z1', 30), pin('c', 'z2', 5), pin('d', 'z1', 20)];
    expect(duplicatePinIds(rows).sort()).toEqual(['a', 'd']);
  });

  it('drops nothing when every zone has one note', () => {
    expect(duplicatePinIds([pin('a', 'z1', 1), pin('b', 'z2', 1)])).toEqual([]);
  });
});
