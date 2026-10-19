import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';

/** Typing pause before the field text becomes the searched query (§11.2.1). */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The search field's text and the committed (debounced, trimmed) query, kept
 * in the route's `?q=`: Back from an opened result lands on the same search,
 * and a search can be linked. Every commit is written with a `replace`
 * navigation (no history entry per search). The URL is read on arrival, then
 * only after a navigation this hook did not make (a hand-edited hash): its own
 * writes are never read back, since the router can still render an older URL
 * than the one just written.
 */
export function useSearchQuery(delayMs: number = SEARCH_DEBOUNCE_MS): {
  /** The query the page arrived with (`?q=`), '' for a fresh search. */
  initial: string;
  text: string;
  setText: (text: string) => void;
  committed: string;
  /** Clears both at once (no debounce). */
  clear: () => void;
} {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [initial] = useState(() => (params.get('q') ?? '').trim());
  const [text, setText] = useState(initial);
  const [committed, setCommitted] = useState(initial);
  /** What `?q=` holds (last written or read). */
  const inUrl = useRef(initial);
  /** The last location looked at (keys can't tell hand-edited entries apart). */
  const seen = useRef(location);

  useEffect(() => {
    if (location === seen.current) return;
    seen.current = location;
    if (navigationType === 'REPLACE') return; // this hook's own write
    const q = (new URLSearchParams(location.search).get('q') ?? '').trim();
    if (q === inUrl.current) return;
    inUrl.current = q;
    setText(q);
    setCommitted(q);
  }, [location, navigationType]);

  // Debounce: the pending commit is cancelled on each keystroke and on unmount.
  useEffect(() => {
    const trimmed = text.trim();
    const timer = setTimeout(() => setCommitted(trimmed), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);

  useEffect(() => {
    if (inUrl.current === committed) return;
    inUrl.current = committed;
    try {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (committed.length > 0) next.set('q', committed);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    } catch {
      // History API throttled (Safari/Firefox throw past ~100 calls in 10 s):
      // the URL just lags behind until the next commit.
    }
  }, [committed, setParams]);

  const clear = useCallback(() => {
    setText('');
    setCommitted('');
  }, []);

  return { initial, text, setText, committed, clear };
}
