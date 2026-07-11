import { forwardRef, useImperativeHandle, useState } from 'react';
import { addTag, commitTokenText, computeTagSuggestions, removeTag } from '../logic';
import { TagPill } from './TagPill';
import styles from './TagInputField.module.css';

/**
 * TagInputField + TagInputController (spec §15). Holds a list of display-name
 * strings; nothing touches the DB until the editor saves. Commit rules: a comma
 * or a trailing space commits the pending token; Enter commits; newlines are
 * impossible (single-line input).
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

  const commit = (text: string): string[] => {
    const token = commitTokenText(text);
    const next = addTag(tags, token);
    onChange(next);
    setInput('');
    return next;
  };

  useImperativeHandle(
    ref,
    () => ({
      commitPending: () => {
        const token = commitTokenText(input);
        const next = addTag(tags, token);
        if (next.length !== tags.length) onChange(next);
        setInput('');
        return next;
      },
    }),
    [input, tags, onChange],
  );

  const onInputChange = (value: string) => {
    if (value.includes(',') || value.endsWith(' ')) {
      commit(value);
    } else {
      setInput(value);
    }
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
