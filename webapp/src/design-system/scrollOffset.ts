import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * ScrollOffsetScope equivalent: a subscription-based store so the
 * TransmissionHeader can track a page body's scroll offset without
 * re-rendering the whole page on every scroll event.
 */

export interface ScrollOffsetStore {
  get: () => number;
  set: (value: number) => void;
  subscribe: (callback: () => void) => () => void;
}

export function createScrollOffsetStore(): ScrollOffsetStore {
  let value = 0;
  const subscribers = new Set<() => void>();
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return;
      value = v;
      subscribers.forEach((cb) => cb());
    },
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

export const ScrollOffsetContext = createContext<ScrollOffsetStore | null>(null);

const noopSubscribe = () => () => {};
const zero = () => 0;

/** Current scroll offset from the nearest scope; static 0 without one. */
export function useScrollOffset(): number {
  const store = useContext(ScrollOffsetContext);
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.get ?? zero);
}
