import { useOnline } from '../core/useOnline';
import styles from './OfflineBanner.module.css';

/**
 * One-line "Offline" strip above the nav while the device has no network.
 * Everything that ships with the app keeps working (catalog tools, the
 * knowledge base, maps, your data); only the NASA tools need a connection.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={styles.banner} role="status">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.title}>Offline</span>
      <span className={styles.sub}>Your data and the offline tools still work.</span>
    </div>
  );
}
