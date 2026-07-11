import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

/**
 * Minimal `liveQuery` → React binding (no dexie-react-hooks dependency).
 * `data` is undefined until the first emission (loading); `error` holds any
 * querier rejection. Pass a stable `querier` (a module-level function) or list
 * its dependencies in `deps` so the subscription is recreated when they change.
 */
export interface LiveQueryResult<T> {
  data: T | undefined;
  error: unknown;
}

export function useLiveQuery<T>(
  querier: () => Promise<T>,
  deps: readonly unknown[] = [],
): LiveQueryResult<T> {
  const [result, setResult] = useState<LiveQueryResult<T>>({
    data: undefined,
    error: undefined,
  });

  useEffect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (data) => setResult({ data, error: undefined }),
      error: (error) => setResult({ data: undefined, error }),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
