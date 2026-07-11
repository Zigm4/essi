import { useLocation } from 'react-router-dom';
import { BlinkingCursor } from '../../design-system/components/AnimatedPrimitives';
import { GlassCard } from '../../design-system/components/GlassCard';
import styles from './ModulePending.module.css';

/**
 * Terminal-style placeholder card for feature routes not yet implemented.
 * Feature agents replace the page component around it without touching the
 * router.
 */
export function ModulePending() {
  const location = useLocation();
  return (
    <div className={styles.center}>
      <GlassCard className={styles.card} glow>
        <div className={styles.title}>
          MODULE PENDING <BlinkingCursor />
        </div>
        <div className={styles.subtitle}>This console module is not installed yet.</div>
        <div className={styles.route}>{location.pathname}</div>
      </GlassCard>
    </div>
  );
}
