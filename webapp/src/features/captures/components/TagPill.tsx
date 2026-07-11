import { Haptics } from '../../../core/haptics';
import { IconClose } from '../../../design-system/icons';
import styles from './TagPill.module.css';

/**
 * Tag pill (spec §14). Three modes:
 *  - `onTap` given → interactive filter chip (selection haptic on tap);
 *  - `onRemove` given → inert label with a trailing ✕ (editor selected chips);
 *  - neither → inert read-only chip (cards / detail meta rows).
 */
export function TagPill({
  label,
  selected = false,
  onTap,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  onTap?: () => void;
  onRemove?: () => void;
}) {
  const chipClass = `${styles.chip} ${selected ? styles.selected : ''}`;

  if (onTap !== undefined && onRemove === undefined) {
    return (
      <button
        type="button"
        className={chipClass}
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

  return (
    <span className={chipClass}>
      <span className={styles.label}>{label}</span>
      {onRemove !== undefined && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${label}`}
          onClick={() => {
            Haptics.selection();
            onRemove();
          }}
        >
          <IconClose size={12} />
        </button>
      )}
    </span>
  );
}
