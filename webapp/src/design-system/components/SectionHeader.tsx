import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

/** Row heading above content sections (design-system spec §7.5). */
export function SectionHeader({
  title,
  subtitle,
  icon,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={styles.row}>
        {icon !== undefined && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
      </div>
      {subtitle !== undefined && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
