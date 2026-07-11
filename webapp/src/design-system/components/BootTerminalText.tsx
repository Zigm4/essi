import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../reducedMotion';
import { BlinkingCursor } from './AnimatedPrimitives';
import styles from './BootTerminalText.module.css';

/**
 * Typewriter boot log (design-system spec §7.7): 18ms/char, 180ms/line pause,
 * 4-line window auto-scrolling to the bottom. Reduced motion renders all
 * lines instantly and fires onComplete immediately.
 */
export function BootTerminalText({
  lines,
  charDelay = 18,
  lineDelay = 180,
  visibleLines = 4,
  lineHeight = 18,
  lineSpacing = 4,
  onComplete,
}: {
  lines: string[];
  charDelay?: number;
  lineDelay?: number;
  visibleLines?: number;
  lineHeight?: number;
  lineSpacing?: number;
  onComplete?: () => void;
}) {
  const reduced = useReducedMotion();
  const [committed, setCommitted] = useState<string[]>(reduced ? lines : []);
  const [partial, setPartial] = useState('');
  const [done, setDone] = useState(reduced);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    if (reducedRef.current) {
      setCommitted(lines);
      setPartial('');
      setDone(true);
      onCompleteRef.current?.();
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let lineIndex = 0;
    let charIndex = 0;

    const step = () => {
      if (cancelled) return;
      const line = lines[lineIndex] ?? '';
      if (charIndex < line.length) {
        charIndex += 1;
        setPartial(line.slice(0, charIndex));
        timer = setTimeout(step, charDelay);
      } else {
        setCommitted((prev) => [...prev, line]);
        setPartial('');
        lineIndex += 1;
        charIndex = 0;
        if (lineIndex < lines.length) {
          timer = setTimeout(step, lineDelay);
        } else {
          setDone(true);
          onCompleteRef.current?.();
        }
      }
    };
    timer = setTimeout(step, charDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, charDelay, lineDelay]);

  // Auto-scroll to the bottom as new lines appear (console-window behavior).
  useEffect(() => {
    const el = windowRef.current;
    if (el === null) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reducedRef.current ? 'auto' : 'smooth' });
  }, [committed.length]);

  const height = visibleLines * lineHeight + (visibleLines - 1) * lineSpacing;
  return (
    <div ref={windowRef} className={styles.window} style={{ height }}>
      {committed.map((line, i) => (
        <div
          key={i}
          className={styles.line}
          style={{ height: lineHeight, marginBottom: lineSpacing }}
        >
          {line}
        </div>
      ))}
      {!done && (
        <div className={styles.line} style={{ height: lineHeight }}>
          {partial}
          <BlinkingCursor />
        </div>
      )}
    </div>
  );
}
