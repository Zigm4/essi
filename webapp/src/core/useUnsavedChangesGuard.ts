import { useEffect, useRef } from 'react';
import { openBackLayer } from './backStack';
import { useLayerOrder } from './useCloseOnBack';

/**
 * Protects an editor's unsaved input from the back gesture / browser Back and
 * from a reload or tab close, while `dirty` is true:
 * - Back: the guard is a layer of the back stack (core/backStack.ts) with its
 *   own same-URL history entry, above the editor's. Back only pops that entry
 *   (the route doesn't change); it is pushed again and `onBackAttempt` runs -
 *   typically to show "Discard changes?". A picker or dialog opened over the
 *   dirty editor still closes first.
 * - Reload / close: the browser's own "Leave site?" prompt.
 * When the editor stops being dirty (saved, discarded, closed), the extra
 * entry is popped again so history is left as it was.
 */
export function useUnsavedChangesGuard(dirty: boolean, onBackAttempt: () => void): void {
  const order = useLayerOrder(dirty);
  const callback = useRef(onBackAttempt);
  useEffect(() => {
    callback.current = onBackAttempt;
  });

  useEffect(() => {
    if (!dirty) return;
    const layer = openBackLayer({ order, keep: true, escape: false, onBack: () => callback.current() });
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      layer.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);
}
