import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Haptics } from '../../core/haptics';
import { IconClose } from '../../design-system/icons';
import { TagChip } from '../../design-system/components/TagChip';
import { pastedTagText, splitTagInput, tagTokens } from '../captures/logic';
import styles from './hangar.module.css';

/** Imperative handle so the editor can flush a half-typed tag at Save (spec §4.7, F38). */
export interface TagInputHandle {
  /** Commits the pending token and returns the final selected list. */
  commitPending: () => string[];
}

const MAX_SUGGESTIONS = 6;

function addTag(list: string[], token: string): string[] {
  const t = token.trim();
  if (t === '') return list;
  // Duplicate check is case-insensitive; duplicates silently ignored.
  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return list;
  return [...list, t];
}

/**
 * Wrap of removable selected chips + an inline borderless input, with a
 * substring-matched suggestion row (spec §4.7). Comma / space / newline / Enter
 * commit the current token; a pasted list becomes one tag per entry.
 */
export function TagInputField({
  selected,
  onChange,
  pool,
  controlRef,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  pool: string[];
  controlRef?: Ref<TagInputHandle>;
}) {
  const [pending, setPending] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Same tokenizing as the Captures tag field (shared tags): a pasted
  // "intel, mars trade" gives one tag per word, never one merged tag.
  const commit = (): string[] => {
    let next = selected;
    for (const token of tagTokens(pending)) next = addTag(next, token);
    if (next !== selected) onChange(next);
    setPending('');
    return next;
  };

  useImperativeHandle(controlRef, () => ({ commitPending: commit }));

  const handleInput = (raw: string) => {
    const { tokens, pending: rest } = splitTagInput(raw);
    let next = selected;
    for (const token of tokens) next = addTag(next, token);
    if (next !== selected) onChange(next);
    setPending(rest);
  };

  const remove = (tag: string) => {
    Haptics.selection();
    onChange(selected.filter((x) => x !== tag));
  };

  const query = pending.trim().toLowerCase();
  const selectedLower = new Set(selected.map((s) => s.toLowerCase()));
  const suggestions: string[] = [];
  if (query.length > 0) {
    const seen = new Set<string>();
    for (const name of pool) {
      const lower = name.toLowerCase();
      if (seen.has(lower)) continue;
      if (selectedLower.has(lower)) continue;
      if (!lower.includes(query)) continue;
      seen.add(lower);
      suggestions.push(name);
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }
  }

  return (
    <div>
      <div
        className={`${styles.tagField} ${focused ? styles.tagFieldFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        {selected.map((tag) => (
          <span key={tag} className={styles.selectedChip}>
            {tag}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(tag);
              }}
            >
              <IconClose size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.tagInput}
          value={pending}
          placeholder={selected.length === 0 ? 'Add tag…' : ''}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => handleInput(e.target.value)}
          onPaste={(e) => {
            const el = e.currentTarget;
            const value = pastedTagText(
              pending,
              el.selectionStart ?? pending.length,
              el.selectionEnd ?? pending.length,
              e.clipboardData.getData('text'),
            );
            if (value === null) return;
            e.preventDefault();
            handleInput(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && pending === '' && selected.length > 0) {
              e.preventDefault();
              remove(selected[selected.length - 1]);
            }
          }}
        />
      </div>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((name) => (
            <TagChip
              key={name}
              label={name}
              onTap={() => {
                const next = addTag(selected, name);
                if (next !== selected) onChange(next);
                setPending('');
                inputRef.current?.focus();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
