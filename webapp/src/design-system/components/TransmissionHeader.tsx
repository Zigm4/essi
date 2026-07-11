import { useRef, type ReactNode } from 'react';
import { PulsingDot } from './AnimatedPrimitives';
import { randomSectorSeed, sectorCodeText } from '../sectorCode';
import { useScrollOffset } from '../scrollOffset';
import styles from './TransmissionHeader.module.css';

/**
 * The "ESSI banner" (design-system spec §6.1): opaque #03060B bar with a
 * pulsing green dot, the uppercase label, and the scroll-driven sector code.
 */
export function TransmissionHeader({
  label,
  sector,
  actions,
}: {
  label: string;
  /** Explicit sector string shown verbatim; otherwise scroll-driven. */
  sector?: string;
  actions?: ReactNode;
}) {
  const seedRef = useRef(randomSectorSeed());
  const offset = useScrollOffset();
  const code = sector ?? sectorCodeText(seedRef.current, offset);

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <PulsingDot color="#5FE8A0" size={6} />
        <span className={styles.label}>{label}</span>
        <span className={styles.sector}>{code}</span>
        {actions !== undefined && <span className={styles.actions}>{actions}</span>}
      </div>
    </div>
  );
}

/** Trailing action icon button for banner actions (e.g. + on Notes/Hangar). */
export function BannerAction({
  label,
  onTap,
  children,
}: {
  label: string;
  onTap: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={styles.actionButton} aria-label={label} onClick={onTap}>
      {children}
    </button>
  );
}
