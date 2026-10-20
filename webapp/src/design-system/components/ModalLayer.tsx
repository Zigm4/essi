import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCloseOnBack, useLayerOrder } from '../../core/useCloseOnBack';

/**
 * Host for a modal overlay - a sheet, a dialog, a full-screen detail. Mount it
 * while the overlay is open, around the overlay's own markup (scrim + panel):
 * - portals it to <body>, above any page-level stacking context, the nav and
 *   the backup-reminder footer;
 * - Back / Escape close it (top-most overlay only: core/useCloseOnBack);
 * - focus moves into the panel (its `role="dialog"` / `"alertdialog"` element,
 *   which should carry `tabIndex={-1}`) and goes back to the opener on close;
 * - the app behind and any overlay under it are `inert`, so Tab stays inside.
 */
export function ModalLayer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnBack(true, onClose);
  useModalFocus(containerRef);
  return createPortal(<div ref={containerRef}>{children}</div>, document.body);
}

interface OpenModal {
  el: HTMLElement;
  order: number;
}

/** Open modal layers; all but the top-most are inert, and so is the app. */
const openModals: OpenModal[] = [];

function refreshInert(): void {
  const root = document.getElementById('root');
  if (openModals.length > 0) root?.setAttribute('inert', '');
  else root?.removeAttribute('inert');
  const top = Math.max(...openModals.map((m) => m.order));
  for (const m of openModals) m.el.toggleAttribute('inert', m.order !== top);
}

/**
 * Moves focus into the layer's dialog and makes everything else inert; on
 * unmount releases it and gives focus back to whatever had it before (if
 * still on the page). Ranked like the back stack, so a layer rendered inside
 * another stays on top even when both open in the same commit.
 */
function useModalFocus(containerRef: RefObject<HTMLElement | null>): void {
  const order = useLayerOrder(true);
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const entry: OpenModal = { el: container, order };
    openModals.push(entry);
    refreshInert();
    const target =
      container.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? container;
    // Under a layer that opened in the same commit (rendered inside it): that one keeps focus.
    // A field inside that took focus itself (autoFocus) keeps it too.
    if (!container.hasAttribute('inert') && !container.contains(opener)) target.focus({ preventScroll: true });
    return () => {
      openModals.splice(openModals.indexOf(entry), 1);
      container.removeAttribute('inert');
      refreshInert(); // first: an inert element can't take focus
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);
}
