import { useEffect } from 'react';
import { useSnackbarStore } from '../../core/snackbar';
import styles from './SnackbarHost.module.css';

const AUTO_DISMISS_MS = 4000;

/** Renders the app-wide snackbar/toast; auto-dismisses after 4s. */
export function SnackbarHost() {
  const { message, danger, key, dismiss } = useSnackbarStore();

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, key, dismiss]);

  if (message === null) return null;
  return (
    <div className={`${styles.snackbar} ${danger ? styles.danger : ''}`} role="status">
      {message}
    </div>
  );
}
