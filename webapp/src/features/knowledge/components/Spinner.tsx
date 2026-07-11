import styles from './Spinner.module.css';

/** Centered circular progress indicator. `padded` adds the 24px top padding
 * used by the search/results loading states. */
export function Spinner({ padded = false }: { padded?: boolean }) {
  return (
    <div className={`${styles.wrap} ${padded ? styles.padded : ''}`}>
      <span className={styles.spinner} aria-label="Loading" role="status" />
    </div>
  );
}
