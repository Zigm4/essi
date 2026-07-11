import type { CSSProperties, ReactNode } from 'react';
import styles from './InfoCard.module.css';

/** Lightweight panel used inside "How it works" sheets (spec §7.2). */
export function InfoCard({
  padding,
  className,
  children,
}: {
  padding?: number | string;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {};
  if (padding !== undefined) style.padding = padding;
  return (
    <div className={`${styles.card} ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}
