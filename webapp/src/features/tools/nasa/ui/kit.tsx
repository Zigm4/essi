import type { CSSProperties } from 'react';
import { Haptics } from '../../../../core/haptics';
import styles from './nasa.module.css';

/** Small indeterminate spinner (stroke 2, accentPrimary). */
export function Spinner({ size = 18 }: { size?: number }) {
  const border = Math.max(2, Math.round(size / 9));
  return <span className={styles.spinner} style={{ width: size, height: size, borderWidth: border }} />;
}

/** 1px divider tinted borderSubtle at the given alpha. */
export function Divider({ alpha = 0.4, margin }: { alpha?: number; margin?: string }) {
  return (
    <div
      className={styles.divider}
      style={{ background: `rgba(122, 227, 255, ${alpha})`, margin }}
    />
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** The square segmented control (Scan mode, Tracker kind). */
export function SquareSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`${styles.segTrack} ${disabled ? styles.segDisabled : ''}`} role="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.segItem} ${selected ? styles.segItemSelected : ''}`}
            onClick={() => {
              if (selected) return;
              Haptics.selection();
              onChange(o.value);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The fully-rounded pill segmented control (Discoveries kind). */
export function PillSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`${styles.segTrack} ${styles.segPillTrack} ${disabled ? styles.segDisabled : ''}`}
      role="tablist"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.segItem} ${styles.segPillItem} ${
              selected ? `${styles.segItemSelected} ${styles.segPillItemSelected}` : ''
            }`}
            onClick={() => {
              if (selected) return;
              Haptics.selection();
              onChange(o.value);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bordered mode/kind pill (history rows, share cards, detail). */
export function PillBadge({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <span className={styles.pillBadge} style={style}>
      {text}
    </span>
  );
}
