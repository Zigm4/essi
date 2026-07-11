import { IconCancel } from './hangarIcons';
import { IconCheck } from '../../design-system/icons';
import styles from './hangar.module.css';

export interface PickerItem {
  key: string;
  title: string;
  subtitle?: string | null;
}

export interface PickerGroup {
  label: string;
  items: PickerItem[];
}

/**
 * Modal bottom sheet used by the model & location pickers (spec §7.1 / §7.2).
 * An explicit tap (including the "none" row) calls `onPick`; tapping the
 * scrim calls `onDismiss` and leaves the selection unchanged — the two must
 * stay distinguishable.
 */
export function PickerSheet({
  title,
  noneLabel,
  selectedKey,
  groups,
  onPick,
  onDismiss,
}: {
  title: string;
  noneLabel: string;
  selectedKey: string | null;
  groups: PickerGroup[];
  onPick: (key: string | null) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <button type="button" className={styles.pickerScrim} aria-label="Dismiss" onClick={onDismiss} />
      <div className={styles.pickerSheet} role="dialog" aria-label={title}>
        <div className={styles.pickerTitle}>{title}</div>
        <div className={styles.pickerList}>
          <button
            type="button"
            className={`${styles.pickerTile} ${selectedKey === null ? styles.pickerTileSelected : ''}`}
            onClick={() => onPick(null)}
          >
            <span className={styles.pickerTileLeading}>
              <IconCancel size={20} />
            </span>
            <span className={styles.pickerTileText}>
              <span className={styles.pickerTileName}>{noneLabel}</span>
            </span>
            {selectedKey === null && (
              <span className={styles.pickerTileCheck}>
                <IconCheck size={18} />
              </span>
            )}
          </button>

          {groups.map((group) => (
            <div key={group.label}>
              <div className={styles.pickerGroupLabel}>{group.label}</div>
              {group.items.map((item) => {
                const isSelected = item.key === selectedKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.pickerTile} ${isSelected ? styles.pickerTileSelected : ''}`}
                    onClick={() => onPick(item.key)}
                  >
                    <span className={styles.pickerTileText}>
                      <span className={styles.pickerTileName}>{item.title}</span>
                      {item.subtitle != null && item.subtitle.length > 0 && (
                        <span className={styles.pickerTileSubtitle}>{item.subtitle}</span>
                      )}
                    </span>
                    {isSelected && (
                      <span className={styles.pickerTileCheck}>
                        <IconCheck size={18} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
