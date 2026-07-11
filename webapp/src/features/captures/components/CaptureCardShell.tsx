import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Haptics } from '../../../core/haptics';
import { GlassCard } from '../../../design-system/components/GlassCard';
import styles from './CaptureCardShell.module.css';

const LONG_PRESS_MS = 500;

/**
 * Interactive wrapper around a GlassCard list row. Tap/Enter opens the detail
 * route; a touch long-press or a right-click opens the delete confirmation
 * (the pointer-friendly equivalent of the Flutter long-press, spec §25.2).
 */
export function CaptureCardShell({
  ariaLabel,
  onOpen,
  onDelete,
  children,
}: {
  ariaLabel: string;
  onOpen: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onDelete();
    }, LONG_PRESS_MS);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={styles.shell}
      onClick={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        Haptics.tap();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          Haptics.tap();
          onOpen();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
    >
      <GlassCard>{children}</GlassCard>
    </div>
  );
}
