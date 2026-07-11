import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, type JobStatusValue } from '../../../data/db';

/**
 * Reactive map of jobId → status. A job with no row is implicitly `todo`, so
 * absent keys must be read as `todo` by callers. One live query drives the
 * whole jobs list.
 */
export function useJobStatusMap(): Map<string, JobStatusValue> {
  const [map, setMap] = useState<Map<string, JobStatusValue>>(() => new Map());
  useEffect(() => {
    const sub = liveQuery(() => db.jobStatus.toArray()).subscribe({
      next: (rows) => setMap(new Map(rows.map((r) => [r.jobId, r.status]))),
      error: () => setMap(new Map()),
    });
    return () => sub.unsubscribe();
  }, []);
  return map;
}

/** Writes a job's status. Setting it back to `todo` deletes the row. */
export async function setJobStatus(jobId: string, status: JobStatusValue): Promise<void> {
  if (status === 'todo') {
    await db.jobStatus.delete(jobId);
  } else {
    await db.jobStatus.put({ jobId, status, updatedAt: Date.now() });
  }
}
