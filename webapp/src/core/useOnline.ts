import { useSyncExternalStore } from 'react';

/**
 * True when the browser knows it has no network. `navigator.onLine` is only
 * reliable this way round: false means offline, true may still be a dead
 * connection (that case surfaces as a NetworkError instead).
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Re-renders when the connection drops or comes back; false while offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !isOffline(),
    () => true,
  );
}
