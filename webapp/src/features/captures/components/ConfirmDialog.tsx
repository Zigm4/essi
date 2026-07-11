import { useEffect } from 'react';
import styles from './ConfirmDialog.module.css';

/**
 * AlertDialog on `bgElevated` (spec §6/§8): title, optional body, a neutral
 * cancel action and a confirm action (danger-tinted for destructive flows).
 * Esc and backdrop click both resolve to cancel.
 */
export function ConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.scrim} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.title}>{title}</div>
        {message !== undefined && <div className={styles.body}>{message}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${danger ? styles.danger : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
