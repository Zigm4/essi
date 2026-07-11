import type { ReactNode } from 'react';
import { Haptics } from '../../core/haptics';
import styles from './NeonButton.module.css';

/** Primary CTA (design-system spec §7.3). */
export function NeonButton({
  title,
  icon,
  onPressed,
  enabled = true,
  danger = false,
  className,
}: {
  title: string;
  icon?: ReactNode;
  onPressed: () => void;
  enabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${danger ? styles.danger : ''} ${className ?? ''}`}
      disabled={!enabled}
      aria-label={title}
      onClick={() => {
        Haptics.tap();
        onPressed();
      }}
    >
      {icon !== undefined && <span className={styles.icon}>{icon}</span>}
      {title}
    </button>
  );
}
