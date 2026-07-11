import { Haptics } from '../../../core/haptics';
import type { CapturesMode } from '../capturesStore';
import styles from './SegmentedControl.module.css';

/** Notes | Links segmented control (spec §5.4). Fires a selection haptic. */
export function SegmentedControl({
  mode,
  onChange,
}: {
  mode: CapturesMode;
  onChange: (mode: CapturesMode) => void;
}) {
  const select = (next: CapturesMode) => {
    if (next === mode) return;
    Haptics.selection();
    onChange(next);
  };
  return (
    <div className={styles.outer} role="tablist" aria-label="Capture type">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'notes'}
        className={`${styles.cell} ${mode === 'notes' ? styles.selected : ''}`}
        onClick={() => select('notes')}
      >
        Notes
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'links'}
        className={`${styles.cell} ${mode === 'links' ? styles.selected : ''}`}
        onClick={() => select('links')}
      >
        Links
      </button>
    </div>
  );
}
