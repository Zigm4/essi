import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType, type Location } from 'react-router-dom';
import { sanitizeFilter, type JobsFacetOptions } from './jobsFacets';
import { filtersEqual, type JobFilter } from './jobsLogic';
import { decodeJobsSearch, encodeJobsSearch } from './jobsUrl';

/** How long the search must sit still before `q` is written to the URL. */
const QUERY_URL_DELAY_MS = 300;

/**
 * Keeps the filter and the route's query string in step (spec §3.3).
 *
 * - Reading: once the data is loaded, the URL wins for the shareable fields
 *   (a shared link); later it is read again only after a navigation this hook
 *   did not make (a hand-edited hash). Its own `replace` navigations are never
 *   read back: the router commits them in a transition, so a render can still
 *   see an older URL than the one already written, and re-reading that would
 *   undo the latest change.
 * - Writing: every filter change is mirrored with a `replace` navigation (no
 *   history entry). Typing in the search is mirrored once it pauses, so a
 *   keystroke costs neither a history write nor a second list render, and
 *   long typing stays under the browsers' history-API rate limits.
 *
 * Waits for the data so unknown values (and stale stored ones) are dropped first.
 */
export function useJobsUrlSync(
  options: JobsFacetOptions | null,
  filter: JobFilter,
  setFilter: (f: JobFilter) => void,
): void {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  /** The last committed location this hook looked at. */
  const seen = useRef<Location | null>(null);
  /** What the URL holds (last written or read) and the search text in it. */
  const written = useRef<{ search: string; query: string } | null>(null);

  useEffect(() => {
    if (options === null) return;
    if (location !== seen.current) {
      const external = seen.current === null || navigationType !== 'REPLACE';
      seen.current = location;
      if (external) {
        const shared = decodeJobsSearch(location.search, options);
        written.current = { search: location.search, query: shared?.query ?? '' };
        const next = sanitizeFilter(shared === null ? filter : { ...filter, ...shared }, options);
        if (!filtersEqual(next, filter)) {
          setFilter(next);
          return; // the store update re-runs this effect, which then writes the canonical URL
        }
      }
    }

    const last = written.current;
    const wanted = encodeJobsSearch(filter);
    if (last === null || wanted === last.search) return;
    const write = () => {
      try {
        navigate({ pathname: location.pathname, search: wanted }, { replace: true });
        written.current = { search: wanted, query: filter.query };
      } catch {
        // History API throttled (Safari/Firefox throw past ~100 calls in 10 s):
        // the URL just lags behind, the store already holds the filter.
      }
    };
    const typingOnly =
      filter.query !== last.query && encodeJobsSearch({ ...filter, query: last.query }) === last.search;
    if (!typingOnly) {
      write();
      return;
    }
    const timer = window.setTimeout(write, QUERY_URL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [options, filter, location, navigationType, navigate, setFilter]);
}
