import { useEffect, useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { loadCatalog } from '../shared/catalog';
import { parseJobsJson, type Job } from './jobModel';

/**
 * Loads + parses `jobs.json` (~337KB, 371 rows) once. The parse is done off the
 * render path in the async `.then` (spec §1.6 — inline async parse is fast
 * enough on modern browsers; no Web Worker needed).
 */
export function useJobs(): { jobs: Job[] | null; error: string | null } {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadCatalog<unknown>('jobs.json')
      .then((data) => {
        const parsed = parseJobsJson(data);
        if (alive) setJobs(parsed);
      })
      .catch((e: unknown) => {
        if (alive) setError(friendlyError(e, "Couldn't load jobs."));
      });
    return () => {
      alive = false;
    };
  }, []);
  return { jobs, error };
}
