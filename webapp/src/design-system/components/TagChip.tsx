import { Haptics } from '../../core/haptics';
import styles from './TagChip.module.css';

/** Pill chip (app-shell spec §1.5). Fires a selection haptic on tap. */
export function TagChip({
  label,
  selected = false,
  onTap,
}: {
  label: string;
  selected?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      onClick={() => {
        Haptics.selection();
        onTap();
      }}
    >
      {label}
    </button>
  );
}
