import { useEffect, useRef, useState } from 'react';
import { Haptics } from '../../core/haptics';
import { IconCheck, IconContentCopy } from '../icons';
import styles from './CodeBlock.module.css';

/** Copyable code snippet (design-system spec §7.9 CodeBlock). */
export function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      Haptics.success();
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions) — silently ignore.
    }
  };

  return (
    <div className={styles.container}>
      <code className={styles.code}>{text}</code>
      <button
        type="button"
        className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
        aria-label="Copy"
        onClick={() => {
          void copy();
        }}
      >
        {copied ? <IconCheck size={11} /> : <IconContentCopy size={11} />}
      </button>
    </div>
  );
}
