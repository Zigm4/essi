import { useSyncExternalStore } from 'react';
import { useSettingsStore } from '../data/settings';

/**
 * App-wide reduced-motion rule: animations are skipped when the in-app
 * settings.reduceAnimations flag is on OR the browser signals
 * prefers-reduced-motion (design-system spec §1 accessibility note).
 */

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const inApp = useSettingsStore((s) => s.reduceAnimations);
  const system = useSyncExternalStore(subscribe, getSnapshot);
  return inApp || system;
}

/** Imperative variant for non-React code paths. */
export function isReducedMotion(): boolean {
  return useSettingsStore.getState().reduceAnimations || window.matchMedia(QUERY).matches;
}
