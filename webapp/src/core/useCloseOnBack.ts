import { useEffect, useRef, useState } from 'react';
import { claimLayerOrder, openBackLayer } from './backStack';

/**
 * The stacking order of a layer while `active`: claimed while rendering, so a
 * layer opened later - or rendered inside another one, even in the same
 * commit (effects run child-first) - ranks above it.
 */
export function useLayerOrder(active: boolean): number {
  const [order, setOrder] = useState(0);
  if (active && order === 0) {
    const next = claimLayerOrder();
    setOrder(next);
    return next;
  }
  if (!active && order !== 0) setOrder(0);
  return order;
}

/**
 * Back closes the overlay instead of leaving the screen: while `open`, the
 * Android back gesture, the browser's Back button and Escape run `onClose` -
 * for the top-most open overlay only, so a sheet over a sheet closes one at a
 * time. Closing it any other way (a button, the scrim, a drag) removes its
 * history entry again without navigating. See core/backStack.ts.
 */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  const order = useLayerOrder(open);
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  // Keyed on `open` only: callers pass inline `onClose`s, which must not re-open the layer.
  useEffect(() => {
    if (!open) return;
    const layer = openBackLayer({ order, onBack: () => latest.current() });
    return () => layer.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
