import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { withAlpha } from '../color';
import { useReducedMotion } from '../reducedMotion';
import styles from './AnimatedPrimitives.module.css';

/** Animated primitives (design-system spec §8). All render static
 *  end-states when reduced motion is active. */

export function PulsingDot({ color, size = 6 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  return (
    <span
      className={`${styles.dot} ${reduced ? '' : styles.dotPulse}`}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

export function BlinkingCursor() {
  const reduced = useReducedMotion();
  return <span className={`${styles.cursor} ${reduced ? '' : styles.cursorBlink}`}>▋</span>;
}

export function PulsingGlow({
  color = '#4FC3FF',
  radius,
  className,
  children,
}: {
  color?: string;
  radius?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const style = {
    '--glow-min': `0 0 4px ${withAlpha(color, 0.2)}`,
    '--glow-max': `0 0 10px ${withAlpha(color, 0.7)}`,
    '--glow-static': `0 0 6px ${withAlpha(color, 0.45)}`,
    borderRadius: radius,
  } as CSSProperties;
  return (
    <div className={`${reduced ? styles.glowStatic : styles.glow} ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

export function PulsingScale({
  color = '#4FC3FF',
  className,
  children,
}: {
  color?: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const style = {
    '--scale-glow-min': `0 0 2px ${withAlpha(color, 0.2)}`,
    '--scale-glow-max': `0 0 6px ${withAlpha(color, 0.6)}`,
    '--scale-glow-static': `0 0 2px ${withAlpha(color, 0.5)}`,
  } as CSSProperties;
  return (
    <div className={`${reduced ? styles.scaleStatic : styles.scale} ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

export function ConsoleReveal({
  delay = 0,
  glitch = false,
  className,
  children,
}: {
  delay?: number;
  glitch?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    if (reducedRef.current) {
      setShown(true);
      return;
    }
    const timer = setTimeout(() => setShown(true), delay + (glitch ? 60 : 0));
    return () => clearTimeout(timer);
  }, [delay, glitch]);

  const classes = [
    styles.reveal,
    shown ? styles.revealShown : '',
    reduced ? styles.revealInstant : '',
    className ?? '',
  ].join(' ');
  return (
    <div className={classes} style={{ transitionDuration: glitch ? '180ms' : '220ms' }}>
      {children}
    </div>
  );
}
