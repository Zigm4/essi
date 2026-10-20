import type { ReactNode } from 'react';
import { ModalLayer } from './ModalLayer';
import styles from './HowItWorksSheet.module.css';

/**
 * Bottom-sheet scaffold for every "How it works" explainer (spec §7.8).
 * Fixed ~92dvh panel with internal scroll; Close, the scrim, Back and Escape
 * dismiss it (a modal layer: focus moves in and comes back on close).
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
    <ModalLayer onClose={onClose}>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="How it works" tabIndex={-1}>
        <div className={styles.appBar}>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
          <span className={styles.title}>How it works</span>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </ModalLayer>
  );
}
