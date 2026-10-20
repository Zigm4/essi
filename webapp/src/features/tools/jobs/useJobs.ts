import { useCatalog } from '../shared/useCatalog';
import { parseJobsJson, type Job } from './jobModel';

/**
 * Loads + parses `jobs.json` (~337KB, 371 rows) once. The parse is done off the
 * render path in the async `.then` (spec §1.6 - inline async parse is fast
 * enough on modern browsers; no Web Worker needed).
 */
export function useJobs(): { jobs: Job[] | null; error: string | null; retry: () => void } {
  const { data, error, retry } = useCatalog('jobs.json', parseJobsJson, "Couldn't load jobs.");
  return { jobs: data, error, retry };
}
