import { PulsingDot } from '../design-system/components/AnimatedPrimitives';
import { versionShortLabel } from '../core/version';
import { TAB_LABELS, tabIcon, useTabNavigation } from './tabs';
import styles from './SideNav.module.css';

/**
 * Desktop (>= 900px) persistent left nav rail — same navigation model as the
 * mobile bottom capsule, styled as a terminal command-deck column.
 */
export function SideNav() {
  const { current, onTab } = useTabNavigation();

  return (
    <nav className={styles.rail} aria-label="Main">
      <div className={styles.brand}>
        <span className={styles.emblem}>ES</span>
        <span>
          <span className={styles.wordmark}>ESSI</span>
          <span className={styles.brandSub} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PulsingDot color="#5FE8A0" size={5} />
            OPERATOR TERMINAL
          </span>
        </span>
      </div>
      <div className={styles.items}>
        {TAB_LABELS.map((label, i) => {
          const active = i === current;
          return (
            <button
              key={label}
              type="button"
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTab(i)}
            >
              <span className={styles.itemIcon}>{tabIcon(i, active, 22)}</span>
              {label}
            </button>
          );
        })}
      </div>
      <div className={styles.footer}>{versionShortLabel.toUpperCase()} · LOCAL CONSOLE</div>
    </nav>
  );
}
