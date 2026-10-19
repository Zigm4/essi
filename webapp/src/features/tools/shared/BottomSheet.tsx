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
 * Modal bottom sheet (spec §1.4). The grab handle is a live control: drag the
 * top band down past a threshold to dismiss, or tap the handle itself to close
 * (the native mobile gesture) - scrim tap and Escape also dismiss. Dismissal
 * is deliberate: an upward, sideways, short or cancelled drag snaps back. The
 * body scrolls internally with a safe-area bottom inset so the last control
 * never hides behind the phone's bottom bar. An optional `footer` is pinned
 * under the scrolling body (it carries the safe-area inset instead), so
 * nothing scrolls beneath it.
 *
 * Focus: opening moves focus into the panel and makes the app behind it
 * `inert` (so Tab stays in the sheet); closing gives focus back to whatever
 * had it before.
 */

const DISMISS_THRESHOLD_PX = 110;
const TAP_SLOP_PX = 6;

type HandleGesture = 'tap' | 'dismiss' | 'snapBack';

/**
 * What a released handle gesture means, from its total travel (dy > 0 is
 * down). Only a drag down past the threshold that is more vertical than
 * sideways dismisses; a press that barely moved is a tap. Anything else (up,
 * sideways, too short) snaps back.
 */
function classifyGesture(dx: number, dy: number): HandleGesture {
  if (Math.abs(dx) < TAP_SLOP_PX && Math.abs(dy) < TAP_SLOP_PX) return 'tap';
  if (dy > DISMISS_THRESHOLD_PX && Math.abs(dx) < dy) return 'dismiss';
  return 'snapBack';
}

interface HandleDrag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Pressed on the visible handle (only there does a tap close). */
  onGrip: boolean;
}

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
  const [dragging, setDragging] = useState(false);
  const drag = useRef<HandleDrag | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const hasFooter = footer !== undefined && footer !== null && footer !== false;

  // Keyed on `open` only: callers pass inline `onClose`s, which must not re-run this.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = holdAppInert();
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      // Drop a gesture cut short by Escape / scrim / the caller closing.
      drag.current = null;
      setDragging(false);
      setDragY(0);
      release(); // first: an inert element can't take focus
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // One pointer at a time; a second finger or a non-primary button is ignored.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current !== null || e.button !== 0) return;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      onGrip: gripRef.current?.contains(e.target as Node) ?? false,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d === null || e.pointerId !== d.pointerId) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
    setDragY(0);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d === null || e.pointerId !== d.pointerId) return;
    const gesture = classifyGesture(e.clientX - d.startX, e.clientY - d.startY);
    endDrag();
    if (gesture === 'dismiss' || (gesture === 'tap' && d.onGrip)) onClose();
  };
  // The browser took the pointer over (scroll, system gesture): never a dismiss.
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) endDrag();
  };

  const sheetStyle: CSSProperties = {
    maxHeight: `${Math.round(heightFraction * 100)}dvh`,
    borderRadius: `${radius}px ${radius}px 0 0`,
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : undefined,
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <button
            ref={gripRef}
            type="button"
            className={styles.grip}
            aria-label="Drag down or tap to close"
            // Keyboard / assistive-tech activation (detail 0); pointer taps go
            // through the gesture handling above.
            onClick={(e) => {
              if (e.detail === 0) onClose();
            }}
          >
            <span className={styles.handle} />
          </button>
        </div>
        <div className={hasFooter ? `${styles.body} ${styles.bodyWithFooter}` : styles.body}>{children}</div>
        {hasFooter && <div className={styles.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
