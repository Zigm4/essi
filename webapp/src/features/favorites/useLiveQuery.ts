import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

/** Discriminated result of a live Dexie subscription. */
export type LiveResult<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown };

/**
 * Subscribe to a Dexie `liveQuery`. The querier re-runs whenever any Dexie
 * table it reads changes, so downstream UI stays live (favorite toggles, note
 * and pin edits, ...). The subscription is torn down and recreated whenever
 * `deps` change - pass the query string / kind so a new input resubscribes.
 *
 * This is the project's generic reactive-Dexie hook: `dexie-react-hooks` is not
 * a dependency, so favorites, notes, links and pins all read through here.
 */
export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: readonly unknown[],
): LiveResult<T> {
  const [result, setResult] = useState<LiveResult<T>>({ status: 'loading' });
  useEffect(() => {
    setResult({ status: 'loading' });
    const subscription = liveQuery(querier).subscribe({
      next: (data: T) => setResult({ status: 'ready', data }),
      error: (error: unknown) => setResult({ status: 'error', error }),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return result;
}
