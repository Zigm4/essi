import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  addTag,
  addTags,
  computeTagSuggestions,
  pastedTagText,
  removeTag,
  splitTagInput,
  tagTokens,
} from '../logic';
import { TagPill } from './TagPill';
import styles from './TagInputField.module.css';

/**
 * TagInputField + TagInputController (spec §15). Holds a list of display-name
 * strings; nothing touches the DB until the editor saves. Commit rules: a comma
 * or a space commits the pending token; Enter commits; a pasted list ("intel,
 * mars" or one tag per line) becomes one tag per entry.
 */

export interface TagInputHandle {
  /**
   * `commitPending` (F38): commit any half-typed token and return the resulting
   * tag list so the caller can save it synchronously.
   */
  commitPending: () => string[];
}

export const TagInputField = forwardRef<
  TagInputHandle,
  {
    tags: string[];
    onChange: (tags: string[]) => void;
    suggestionPool: string[];
    placeholder?: string;
  }
>(function TagInputField({ tags, onChange, suggestionPool, placeholder = 'Add tag…' }, ref) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const commit = (text: string) => {
    const next = addTags(tags, tagTokens(text));
    if (next.length !== tags.length) onChange(next);
    setInput('');
  };

  useImperativeHandle(
    ref,
    () => ({
      commitPending: () => {
        const next = addTags(tags, tagTokens(input));
        if (next.length !== tags.length) onChange(next);
        setInput('');
        return next;
      },
    }),
    [input, tags, onChange],
  );

  const onInputChange = (value: string) => {
    const { tokens, pending } = splitTagInput(value);
    if (tokens.length > 0) {
      const next = addTags(tags, tokens);
      if (next.length !== tags.length) onChange(next);
    }
    setInput(pending);
  };

  const suggestions = computeTagSuggestions(suggestionPool, tags, input);

  return (
    <div>
      <div className={`${styles.box} ${focused ? styles.focused : ''}`}>
        {tags.map((tag) => (
          <TagPill
            key={tag}
            label={tag}
            selected
            onRemove={() => onChange(removeTag(tags, tag))}
          />
        ))}
        <input
          type="text"
          className={styles.input}
          value={input}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Add tag"
          onChange={(e) => onInputChange(e.target.value)}
          onPaste={(e) => {
            const el = e.currentTarget;
            const value = pastedTagText(
              input,
              el.selectionStart ?? input.length,
              el.selectionEnd ?? input.length,
              e.clipboardData.getData('text'),
            );
            if (value === null) return;
            e.preventDefault();
            onInputChange(value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(input);
            }
          }}
        />
      </div>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((s) => (
            <TagPill
              key={s}
              label={s}
              onTap={() => {
                onChange(addTag(tags, s));
                setInput('');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
