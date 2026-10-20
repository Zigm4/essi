import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSnackbarStore } from '../../core/snackbar';
import styles from './SnackbarHost.module.css';

const AUTO_DISMISS_MS = 4000;

/**
 * Renders the app-wide snackbar/toast; auto-dismisses after 4s (or its own
 * delay) unless persistent. Portaled to <body>, outside the app root an open
 * sheet or dialog makes inert, so "Undo" stays tappable over a sheet.
 */
export function SnackbarHost() {
  const { message, danger, action, persistent, durationMs, key, dismiss } = useSnackbarStore();

  useEffect(() => {
    if (message === null || persistent) return;
    const timer = setTimeout(dismiss, durationMs ?? AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, persistent, durationMs, key, dismiss]);

  if (message === null) return null;
  return createPortal(
    <div className={`${styles.snackbar} ${danger ? styles.danger : ''}`} role="status">
      <span className={styles.message}>{message}</span>
      {action !== null && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            dismiss();
            action.onClick();
          }}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
