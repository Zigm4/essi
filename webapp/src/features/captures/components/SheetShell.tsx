import { useRef, useState, type ReactNode } from 'react';
import { useUnsavedChangesGuard } from '../../../core/useUnsavedChangesGuard';
import { AppBackground } from '../../../design-system/components/AppBackground';
import { ModalLayer } from '../../../design-system/components/ModalLayer';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './SheetShell.module.css';

/**
 * Modal bottom-sheet shell shared by the Note and Link editors (spec §8/§9).
 * Transparent app bar (Cancel / title / Save) over an AppBackground with no
 * scanlines; body scrolls. Cancel, backdrop click, Esc and the back gesture /
 * browser Back all go through the dirty check (`enableDrag:false` semantics -
 * the sheet can't be dismissed around it): clean, they close the editor (a
 * modal layer); with unsaved changes, "Discard changes?" (the guard's entry
 * sits above the editor's). A reload or tab close with unsaved changes gets
 * the browser's "Leave site?" prompt.
 * While an async save runs, Save is disabled so a double click can't save twice.
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
  onSave: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [showDiscard, setShowDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useUnsavedChangesGuard(dirty, () => setShowDiscard(true));

  const handleSave = () => {
    if (savingRef.current) return;
    const result = onSave();
    if (result instanceof Promise) {
      savingRef.current = true;
      setSaving(true);
      void result.finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
    }
  };

  const requestClose = () => {
    if (dirty) setShowDiscard(true);
    else onClose();
  };

  return (
    <ModalLayer onClose={requestClose}>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
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
                  disabled={!canSave || saving}
                  onClick={handleSave}
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
    </ModalLayer>
  );
}
