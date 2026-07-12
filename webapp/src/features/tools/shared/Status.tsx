import styles from './Status.module.css';

/** Centered indeterminate spinner - the CircularProgressIndicator equivalent. */
export function CenteredSpinner() {
  return (
    <div className={styles.center}>
      <span className={styles.spinner} role="progressbar" aria-label="Loading" />
    </div>
  );
}

/** Centered async-error message in accentDanger (spec §1.4 error convention). */
export function CenteredError({ message }: { message: string }) {
  return (
    <div className={styles.center}>
      <span className={styles.error}>{message}</span>
    </div>
  );
}
