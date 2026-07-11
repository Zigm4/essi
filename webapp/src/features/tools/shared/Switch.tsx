import type { CSSProperties } from 'react';
import { Haptics } from '../../../core/haptics';
import styles from './Switch.module.css';

/** Minimal toggle switch. `tint` colors the active track/thumb. */
export function Switch({
  checked,
  onChange,
  tint = 'var(--accent-primary)',
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  tint?: string;
  ariaLabel?: string;
}) {
  const style = { '--switch-tint': tint } as CSSProperties;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`${styles.track} ${checked ? styles.on : ''}`}
      style={style}
      onClick={() => {
        Haptics.selection();
        onChange(!checked);
      }}
    >
      <span className={styles.thumb} />
    </button>
  );
}
