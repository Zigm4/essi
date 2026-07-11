import type { CSSProperties, ReactNode } from 'react';
import { Haptics } from '../../core/haptics';
import styles from './GlassCard.module.css';

/** The standard card (design-system spec §7.1). Renders a button when onTap is given. */
export function GlassCard({
  padding,
  radius,
  glow = false,
  blur = false,
  onTap,
  ariaLabel,
  className,
  style,
  children,
}: {
  padding?: number | string;
  radius?: number;
  glow?: boolean;
  blur?: boolean;
  onTap?: () => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const classes = [
    styles.card,
    blur ? styles.blur : '',
    glow ? styles.glow : '',
    onTap !== undefined ? styles.interactive : '',
    className ?? '',
  ].join(' ');
  const inline: CSSProperties = { ...style };
  if (padding !== undefined) inline.padding = padding;
  if (radius !== undefined) inline.borderRadius = radius;

  if (onTap !== undefined) {
    return (
      <button
        type="button"
        className={classes}
        style={inline}
        aria-label={ariaLabel}
        onClick={() => {
          Haptics.tap();
          onTap();
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={classes} style={inline}>
      {children}
    </div>
  );
}
