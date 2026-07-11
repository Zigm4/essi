import type { ReactNode } from 'react';
import styles from './HowItWorksSheet.module.css';

/**
 * Bottom-sheet scaffold for every "How it works" explainer (spec §7.8).
 * Fixed ~92dvh panel with internal scroll; scrim click dismisses.
 */
export function HowItWorksSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label="How it works">
        <div className={styles.appBar}>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
          <span className={styles.title}>How it works</span>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
}
