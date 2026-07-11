import { useEffect, useRef } from 'react';
import { IconClose, IconSearch } from '../../../design-system/icons';
import styles from './SearchField.module.css';

/**
 * Filled search input shared by KB Home and Global Search (§3.1.1 / §11.2.1):
 * leading search icon, bgGlass fill, borderSubtle -> borderGlow on focus.
 * The optional clear button (a `close` icon) shows only when non-empty and
 * `onClear` is provided; pressing it clears the field and re-focuses.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const showClear = onClear !== undefined && value.length > 0;

  return (
    <div className={styles.field}>
      <span className={styles.leading}>
        <IconSearch size={20} />
      </span>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {showClear && (
        <button
          type="button"
          className={styles.clear}
          title="Clear search"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            onClear?.();
            inputRef.current?.focus();
          }}
        >
          <IconClose size={18} />
        </button>
      )}
    </div>
  );
}
