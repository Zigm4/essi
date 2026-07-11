import styles from './hangar.module.css';

/**
 * Small centered confirm dialog over a scrim, reused by the list (delete) and
 * the editor (discard/delete). Background `bgElevated` (spec §5.3 / §6.2).
 */
export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button type="button" className={styles.dialogScrim} aria-label="Dismiss" onClick={onCancel} />
      <div className={styles.dialog} role="alertdialog" aria-label={title}>
        <div className={styles.dialogTitle}>{title}</div>
        {body != null && <div className={styles.dialogBody}>{body}</div>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={styles.dialogDanger} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
