import { useEffect, useRef } from 'react';

let guardSeq = 0;

/**
 * Protects an editor's unsaved input from the back gesture / browser Back and
 * from a reload or tab close, while `dirty` is true:
 * - Back: a same-URL history entry is pushed while dirty, so Back only pops
 *   that entry (the route doesn't change); it is pushed again and
 *   `onBackAttempt` runs - typically to show "Discard changes?".
 * - Reload / close: the browser's own "Leave site?" prompt.
 * When the editor stops being dirty (saved, discarded, closed), the extra
 * entry is popped again so history is left as it was.
 *
 * The router (HashRouter) keeps working: the pushed entry carries the current
 * history state (its `idx`/`key`), so popping it is a no-op navigation.
 */
export function useUnsavedChangesGuard(dirty: boolean, onBackAttempt: () => void): void {
  const callback = useRef(onBackAttempt);
  callback.current = onBackAttempt;

  useEffect(() => {
    if (!dirty) return;
    guardSeq += 1;
    const marker = `essi-guard-${guardSeq}`;
    const pushGuard = () => {
      const current = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.pushState({ ...current, essiGuard: marker }, '');
    };
    pushGuard();

    const onPopState = () => {
      pushGuard();
      callback.current();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
      const state = window.history.state as { essiGuard?: string } | null;
      if (state?.essiGuard === marker) window.history.back();
    };
  }, [dirty]);
}
