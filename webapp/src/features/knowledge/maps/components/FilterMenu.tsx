/**
 * Map filter menu (maps spec §12.5). Replaces the long flat chip row with one
 * compact dropdown per filterable field (Owner, Role, Railway, ...). Each menu
 * multi-selects its options; a filled trigger shows how many are active. Only
 * one menu opens at a time; outside-click / Escape closes it.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Haptics } from '../../../../core/haptics';
import { IconCheck, IconChevronRight, IconClose } from '../../../../design-system/icons';
import styles from './FilterMenu.module.css';

export interface FilterFieldDef {
  readonly key: string;
  readonly label: string;
  readonly options: readonly string[];
}

export function FilterMenu({
  fields,
  selected,
  onToggle,
  onClear,
}: {
  fields: readonly FilterFieldDef[];
  selected: ReadonlyMap<string, ReadonlySet<string>>;
  onToggle: (key: string, option: string) => void;
  onClear: (key: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId();

  useEffect(() => {
    if (openKey === null) return;
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openKey]);

  return (
    <div className={styles.root} ref={rootRef}>
      {fields.map((field) => {
        const set = selected.get(field.key);
        const count = set?.size ?? 0;
        const isOpen = openKey === field.key;
        const panelId = `${baseId}-${field.key}`;
        return (
          <div key={field.key} className={styles.item}>
            <button
              type="button"
              className={`${styles.trigger} ${count > 0 ? styles.active : ''} ${isOpen ? styles.open : ''}`}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              onClick={() => {
                Haptics.selection();
                setOpenKey((k) => (k === field.key ? null : field.key));
              }}
            >
              <span className={styles.label}>{field.label}</span>
              {count > 0 && <span className={styles.count}>{count}</span>}
              <IconChevronRight size={16} className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`} />
            </button>

            {isOpen && (
              <div className={styles.panel} id={panelId} role="listbox" aria-label={field.label}>
                <div className={styles.panelHead}>
                  <span className={styles.panelTitle}>{field.label}</span>
                  {count > 0 && (
                    <button
                      type="button"
                      className={styles.clear}
                      onClick={() => {
                        Haptics.selection();
                        onClear(field.key);
                      }}
                    >
                      <IconClose size={14} />
                      Clear
                    </button>
                  )}
                </div>
                <div className={styles.options}>
                  {field.options.map((option) => {
                    const on = set?.has(option) ?? false;
                    return (
                      <button
                        type="button"
                        key={option}
                        role="option"
                        aria-selected={on}
                        className={`${styles.option} ${on ? styles.optionOn : ''}`}
                        onClick={() => {
                          Haptics.selection();
                          onToggle(field.key, option);
                        }}
                      >
                        <span className={styles.box}>{on && <IconCheck size={14} />}</span>
                        <span className={styles.optionLabel}>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
