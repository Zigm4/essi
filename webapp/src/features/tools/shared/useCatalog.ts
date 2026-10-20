import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { loadCatalog } from './catalog';

export interface CatalogState<T> {
  data: T | null;
  /** Friendly copy when the load failed, null otherwise. */
  error: string | null;
  /** Loads the catalog again (the error screen's "Try again"). */
  retry: () => void;
}

/**
 * Loads and parses one catalog for a view. `parse` and `fallback` must be
 * stable (module-level), or every render would load it again. A parse that
 * throws reports `fallback`, like a failed fetch.
 */
export function useCatalog<T>(file: string, parse: (raw: unknown) => T, fallback: string): CatalogState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCatalog<unknown>(file)
      .then((raw) => {
        const data = parse(raw);
        if (alive) setState({ data, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setState({ data: null, error: friendlyError(e, fallback) });
      });
    return () => {
      alive = false;
    };
  }, [file, parse, fallback, attempt]);

  const retry = useCallback(() => {
    // Back to the spinner while it loads again.
    setState({ data: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
