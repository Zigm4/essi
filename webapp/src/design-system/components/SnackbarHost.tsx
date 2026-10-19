import { useEffect } from 'react';
import { useSnackbarStore } from '../../core/snackbar';
import styles from './SnackbarHost.module.css';

const AUTO_DISMISS_MS = 4000;

/** Renders the app-wide snackbar/toast; auto-dismisses after 4s (or its own delay) unless persistent. */
export function SnackbarHost() {
  const { message, danger, action, persistent, durationMs, key, dismiss } = useSnackbarStore();

  useEffect(() => {
    if (message === null || persistent) return;
    const timer = setTimeout(dismiss, durationMs ?? AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, persistent, durationMs, key, dismiss]);

  if (message === null) return null;
  return (
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
    </div>
  );
}
