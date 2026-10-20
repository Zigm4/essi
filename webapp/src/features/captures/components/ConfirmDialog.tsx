import { ModalLayer } from '../../../design-system/components/ModalLayer';
import styles from './ConfirmDialog.module.css';

/**
 * AlertDialog on `bgElevated` (spec §6/§8): title, optional body, a neutral
 * cancel action and a confirm action (danger-tinted for destructive flows).
 * Esc, Back and backdrop click all resolve to cancel (a modal layer: focus
 * moves in and comes back on close).
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
  return (
    <ModalLayer onClose={onCancel}>
      <div className={styles.scrim} onClick={onCancel}>
        <div
          className={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
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
    </ModalLayer>
  );
}
