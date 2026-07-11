import { useEffect, useState, type ReactNode } from 'react';
import { AppBackground } from '../../../design-system/components/AppBackground';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './SheetShell.module.css';

/**
 * Modal bottom-sheet shell shared by the Note and Link editors (spec §8/§9).
 * Transparent app bar (Cancel / title / Save) over an AppBackground with no
 * scanlines; body scrolls. Cancel, backdrop click and Esc all route through the
 * unsaved-changes guard (`enableDrag:false` semantics — the sheet can't be
 * dismissed around the dirty check).
 */
export function SheetShell({
  title,
  canSave,
  dirty,
  onClose,
  onSave,
  children,
}: {
  title: string;
  canSave: boolean;
  dirty: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const [showDiscard, setShowDiscard] = useState(false);

  const requestClose = () => {
    if (dirty) setShowDiscard(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDiscard) {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, showDiscard]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close editor"
        onClick={requestClose}
      />
      <div className={styles.sheet}>
        <AppBackground showsScanlines={false}>
          <div className={styles.inner}>
            <div className={styles.appBar}>
              <button type="button" className={styles.cancel} onClick={requestClose}>
                Cancel
              </button>
              <span className={styles.title}>{title}</span>
              <button
                type="button"
                className={styles.save}
                disabled={!canSave}
                onClick={onSave}
              >
                Save
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </div>
        </AppBackground>
      </div>
      {showDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes."
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          danger
          onCancel={() => setShowDiscard(false)}
          onConfirm={() => {
            setShowDiscard(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
