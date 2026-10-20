import { useEffect, useState, type ReactNode } from 'react';
import { safeGetItem, safeSetItem } from '../../../../core/safeStorage';
import { GlassCard } from '../../../../design-system/components/GlassCard';
import { IconExpandLess, IconExpandMore, IconWifiTethering } from '../../../../design-system/icons';
import { Divider } from './kit';
import { BulletRow } from './viewKit';
import styles from './nasa.module.css';

/**
 * The "Network access required" notice of the three NASA tools. It is open the
 * first time a tool is opened; after that it folds to one line (tap to read it
 * again), so on a phone the tool's action button is no longer pushed off screen.
 */
export function NetworkNotice({
  tool,
  summary,
  intro,
  rows,
  footnote,
}: {
  tool: 'scan' | 'tracker' | 'discoveries';
  /** The one line shown when folded. */
  summary: string;
  intro: ReactNode;
  rows: readonly (readonly [label: string, value: string])[];
  footnote?: ReactNode;
}) {
  const key = `underdeck.nasa.networkNotice.${tool}`;
  const [open, setOpen] = useState(() => safeGetItem(key) === null);
  // Read once: next visits start folded.
  useEffect(() => {
    safeSetItem(key, 'seen');
  }, [key]);

  return (
    <GlassCard>
      <button
        type="button"
        className={styles.noticeToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
          <IconWifiTethering size={18} />
        </span>
        <span className={styles.noticeTitle}>
          <span className={styles.headline}>Network access required</span>
          {!open && <span className={styles.caption}>{summary}</span>}
        </span>
        <span className={styles.noticeChevron} aria-hidden="true">
          {open ? <IconExpandLess size={20} /> : <IconExpandMore size={20} />}
        </span>
      </button>
      {open && (
        <>
          <div className={styles.caption} style={{ marginTop: 8 }}>
            {intro}
          </div>
          <Divider alpha={0.4} margin="8px 0" />
          {rows.map(([label, value]) => (
            <BulletRow key={label} label={label} value={value} />
          ))}
          {footnote !== undefined && (
            <div className={styles.caption} style={{ marginTop: 8 }}>
              {footnote}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
