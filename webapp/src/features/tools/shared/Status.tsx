import { Haptics } from '../../../core/haptics';
import { IconReplay } from '../../../design-system/icons';
import styles from './Status.module.css';

/** Centered indeterminate spinner - the CircularProgressIndicator equivalent. */
export function CenteredSpinner() {
  return (
    <div className={styles.center}>
      <span className={styles.spinner} role="progressbar" aria-label="Loading" />
    </div>
  );
}

/**
 * Centered async-error message in accentDanger (spec §1.4 error convention),
 * with a "Try again" button when the load can be retried.
 */
export function CenteredError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={`${styles.center} ${styles.column}`}>
      <span className={styles.error} role="alert">
        {message}
      </span>
      {onRetry !== undefined && <RetryButton onRetry={onRetry} />}
    </div>
  );
}

/** The "Try again" button of a failed load. */
export function RetryButton({ onRetry, label = 'Try again' }: { onRetry: () => void; label?: string }) {
  return (
    <button
      type="button"
      className={styles.retry}
      onClick={() => {
        Haptics.tap();
        onRetry();
      }}
    >
      <IconReplay size={18} />
      {label}
    </button>
  );
}
