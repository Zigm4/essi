import { describe, expect, it } from 'vitest';
import { backupStatusOf, shouldShowReminder, type BackupStatusInput } from './logic';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000_000_000_000;

const empty: BackupStatusInput = {
  notes: [],
  links: [],
  ships: [],
  scanHistory: [],
  trackerHistory: [],
  discoveryHistory: [],
  favorites: [],
  removedFavorites: [],
  jobStatus: [],
  mapPins: [],
  deletions: [],
  localChangeAt: null,
};

function shows(input: BackupStatusInput, lastBackupAt: number): boolean {
  return shouldShowReminder({ status: backupStatusOf(input), lastBackupAt, snoozedUntil: null, now });
}

describe('backupStatusOf', () => {
  it('has no data and no change on a fresh install', () => {
    expect(backupStatusOf(empty)).toEqual({ hasData: false, lastChangedAt: null });
  });

  it('falls back to row timestamps before the first marked write', () => {
    const status = backupStatusOf({
      ...empty,
      notes: [{ updatedAt: now - 3 * DAY }],
      scanHistory: [{ date: now - DAY }],
    });
    expect(status).toEqual({ hasData: true, lastChangedAt: now - DAY });
  });

  it('re-arms the reminder after a deletion made since the backup', () => {
    // Backed up yesterday; today 10 jobs were reset and a note deleted: the
    // remaining rows are all older than the backup, only the marker moved.
    const rows = { ...empty, notes: [{ updatedAt: now - 2 * DAY }] };
    expect(shows(rows, now - DAY)).toBe(false);
    expect(shows({ ...rows, localChangeAt: now - 60_000 }, now - DAY)).toBe(true);
  });

  it('re-arms the reminder after importing rows older than the backup', () => {
    const imported = { ...empty, notes: [{ updatedAt: now - 7 * DAY }] };
    expect(shows({ ...imported, localChangeAt: now - 60_000 }, now - DAY)).toBe(true);
  });

  it('counts resets, removed stars and deleted records as changes but not as data', () => {
    const tombstonesOnly = {
      ...empty,
      jobStatus: [{ status: 'todo', updatedAt: now - 3 * DAY }],
      removedFavorites: [{ removedAt: now - 2 * DAY }],
      deletions: [{ deletedAt: now - DAY }],
    };
    expect(backupStatusOf(tombstonesOnly)).toEqual({ hasData: false, lastChangedAt: now - DAY });

    const withData = {
      ...tombstonesOnly,
      jobStatus: [...tombstonesOnly.jobStatus, { status: 'done', updatedAt: now - 5 * DAY }],
    };
    expect(backupStatusOf(withData)).toEqual({ hasData: true, lastChangedAt: now - DAY });
  });

  it('takes the newest of the marker and the rows', () => {
    const status = backupStatusOf({
      ...empty,
      favorites: [{ createdAt: now }],
      localChangeAt: now - DAY,
    });
    expect(status.lastChangedAt).toBe(now);
  });
});
