import { useNavigate } from 'react-router-dom';
import styles from './CaptureDetail.module.css';

/**
 * Detail-page fallback. `loading` shows a centered spinner on a plain bgDeepest
 * scaffold (spec §10). A missing/deleted id shows an explicit not-found state
 * with a back link instead of spinning forever (spec §25.1 improvement).
 */
export function DetailFallback({ loading, label }: { loading: boolean; label: string }) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className={styles.fallback}>
        <span className={styles.spinner} role="status" aria-label="Loading" />
      </div>
    );
  }
  return (
    <div className={styles.fallback}>
      <p className={styles.fallbackText}>{label}</p>
      <button type="button" className={styles.backLink} onClick={() => navigate('/captures')}>
        Back to captures
      </button>
    </div>
  );
}
