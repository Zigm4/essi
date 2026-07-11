import { BlinkingCursor } from './AnimatedPrimitives';
import { GlassCard } from './GlassCard';
import styles from './TerminalNotes.module.css';

function indexLabel(n: number): string {
  return `[${n.toString().padStart(2, '0')}]`;
}

/** Terminal-style notes card, e.g. `> hangar.notes` (spec §7.6). */
export function TerminalNotes({ title, lines }: { title: string; lines: string[] }) {
  return (
    <GlassCard>
      <div className={styles.header}>
        <span className={styles.title}>{`> ${title}`}</span>
        <span className={styles.onlineDot} />
      </div>
      <div className={styles.divider} />
      {lines.map((line, i) => (
        <div className={styles.line} key={i}>
          <span className={styles.index}>{indexLabel(i + 1)}</span>
          <span className={styles.text}>{line}</span>
        </div>
      ))}
      <div className={styles.pending}>
        <span className={`${styles.index} ${styles.indexPending}`}>
          {indexLabel(lines.length + 1)}
        </span>
        <BlinkingCursor />
      </div>
    </GlassCard>
  );
}
