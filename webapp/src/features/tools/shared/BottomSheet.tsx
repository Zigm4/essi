import { useEffect, type ReactNode } from 'react';
import styles from './BottomSheet.module.css';

/**
 * Modal bottom sheet (spec §1.4). The Flutter DraggableScrollableSheet's
 * initial/min/max fractions collapse on the web to a single max-height panel
 * with internal scroll (drag-resize is optional per spec). Scrim tap and
 * Escape dismiss; a centered drag handle is drawn for parity.
 */
export function BottomSheet({
  open,
  onClose,
  heightFraction = 0.85,
  radius = 22,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Panel max-height as a fraction of the viewport (the sheet's "max" snap). */
  heightFraction?: number;
  radius?: number;
  ariaLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{ maxHeight: `${Math.round(heightFraction * 100)}dvh`, borderRadius: `${radius}px ${radius}px 0 0` }}
      >
        <div className={styles.handleRow}>
          <span className={styles.handle} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
}
