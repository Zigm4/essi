import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, type JobStatusValue } from '../../../data/db';

/**
 * Reactive map of jobId → status. A job with no row (or a dated `todo` row) is
 * `todo` and left out, so absent keys must be read as `todo` by callers. One
 * live query drives the whole jobs list.
 */
export function useJobStatusMap(): Map<string, JobStatusValue> {
  const [map, setMap] = useState<Map<string, JobStatusValue>>(() => new Map());
  useEffect(() => {
    const sub = liveQuery(() => db.jobStatus.toArray()).subscribe({
      next: (rows) =>
        setMap(new Map(rows.filter((r) => r.status !== 'todo').map((r) => [r.jobId, r.status]))),
      error: () => setMap(new Map()),
    });
    return () => sub.unsubscribe();
  }, []);
  return map;
}

/**
 * Writes a job's status. Setting it back to `todo` keeps a dated `todo` row
 * instead of deleting it, so re-importing an older backup can't bring the old
 * status back (newer wins). A job that was never marked has nothing to reset.
 */
export async function setJobStatus(jobId: string, status: JobStatusValue): Promise<void> {
  const row = { jobId, status, updatedAt: Date.now() };
  if (status !== 'todo') {
    await db.jobStatus.put(row);
    return;
  }
  await db.transaction('rw', db.jobStatus, async () => {
    const existing = await db.jobStatus.get(jobId);
    if (existing === undefined || existing.status === 'todo') return;
    await db.jobStatus.put(row);
  });
}
