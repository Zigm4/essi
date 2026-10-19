import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './BottomSheet.module.css';

/**
 * Modal bottom sheet (spec §1.4). The grab handle is a live control: drag it
 * down to dismiss, or tap it to close (the native mobile gesture) - scrim tap
 * and Escape also dismiss. The body scrolls internally with a safe-area bottom
 * inset so the last control never hides behind the phone's bottom bar. An
 * optional `footer` is pinned under the scrolling body (it carries the
 * safe-area inset instead), so nothing scrolls beneath it.
 *
 * Focus: opening moves focus into the panel and makes the app behind it
 * `inert` (so Tab stays in the sheet); closing gives focus back to whatever
 * had it before.
 */

const DISMISS_THRESHOLD_PX = 110;
const TAP_SLOP_PX = 6;

/** Open sheets holding the app root inert (sheets can stack). */
let inertHolds = 0;

function holdAppInert(): () => void {
  const root = document.getElementById('root');
  if (root === null) return () => {};
  inertHolds++;
  root.setAttribute('inert', '');
  return () => {
    inertHolds--;
    if (inertHolds === 0) root.removeAttribute('inert');
  };
}

export function BottomSheet({
  open,
  onClose,
  heightFraction = 0.85,
  radius = 22,
  ariaLabel,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Panel max-height as a fraction of the viewport (the sheet's "max" snap). */
  heightFraction?: number;
  radius?: number;
  ariaLabel?: string;
  /** Pinned below the scrolling body (e.g. an Apply bar). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });
  const panelRef = useRef<HTMLDivElement>(null);
  const hasFooter = footer !== undefined && footer !== null && footer !== false;

  // Keyed on `open` only: callers pass inline `onClose`s, which must not re-run this.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = holdAppInert();
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      release(); // first: an inert element can't take focus
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDragY(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startY: e.clientY, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    setDragY(Math.max(0, e.clientY - drag.current.startY));
  };
  const onPointerEnd = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    // A tap (barely moved) or a decisive drag-down both dismiss; a small partial
    // drag snaps back.
    if (dragY < TAP_SLOP_PX || dragY > DISMISS_THRESHOLD_PX) onClose();
    else setDragY(0);
  };

  const sheetStyle: CSSProperties = {
    maxHeight: `${Math.round(heightFraction * 100)}dvh`,
    borderRadius: `${radius}px ${radius}px 0 0`,
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: drag.current.active ? 'none' : undefined,
  };

  // Portal to <body> so the scrim/sheet escape any page-level stacking context
  // (a tool page wraps its content in a z-index:1 layer) and sit above the
  // sidebar, bottom nav and the backup-reminder footer.
  return createPortal(
    <>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={sheetStyle}
      >
        <div
          className={styles.handleRow}
          role="button"
          tabIndex={0}
          aria-label="Drag down or tap to close"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
          }}
        >
          <span className={styles.handle} />
        </div>
        <div className={hasFooter ? `${styles.body} ${styles.bodyWithFooter}` : styles.body}>{children}</div>
        {hasFooter && <div className={styles.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
