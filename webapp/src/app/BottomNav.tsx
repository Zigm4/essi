import { useReducedMotion } from '../design-system/reducedMotion';
import { TAB_LABELS, tabIcon, useTabNavigation } from './tabs';
import styles from './BottomNav.module.css';

/**
 * Floating glass-capsule bottom nav (app-shell spec §4.2) — mobile only;
 * hidden at >= 900px where the sidebar takes over (CSS media query).
 */
export function BottomNav() {
  const reduced = useReducedMotion();
  const { current, onTab } = useTabNavigation();
  const pillIndex = current >= 0 ? current : 0;

  return (
    <nav className={styles.wrapper} aria-label="Main">
      <div className={styles.capsule}>
        <div
          className={`${styles.pill} ${reduced ? styles.pillInstant : ''}`}
          style={{ left: `calc(6px + (100% - 12px) * ${pillIndex} / 5)` }}
        />
        {TAB_LABELS.map((label, i) => {
          const active = i === current;
          return (
            <button
              key={label}
              type="button"
              className={`${styles.cell} ${active ? styles.cellActive : ''}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTab(i)}
            >
              <span className={styles.icon}>{tabIcon(i, active, 22)}</span>
              <span className={styles.label}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
