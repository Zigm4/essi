import type { ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { IconChevronRight } from '../icons';
import styles from './ToolCard.module.css';

/** Tappable navigation list card used on hub pages (spec §7.4). */
export function ToolCard({
  title,
  subtitle,
  icon,
  tint,
  onTap,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tint: string;
  onTap: () => void;
}) {
  return (
    <GlassCard onTap={onTap} ariaLabel={`${title}. ${subtitle}`}>
      <span className={styles.row}>
        <span className={styles.iconBox} style={{ color: tint }}>
          {icon}
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle} style={{ display: 'block' }}>
            {subtitle}
          </span>
        </span>
        <span className={styles.chevron}>
          <IconChevronRight size={20} />
        </span>
      </span>
    </GlassCard>
  );
}
