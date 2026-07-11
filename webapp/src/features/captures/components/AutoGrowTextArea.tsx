import { useLayoutEffect, useRef } from 'react';

/**
 * Borderless textarea that grows with its content between `minRows` and
 * `maxRows`, then scrolls (spec §8 body: min 6 / max 30 lines; §9 note: min 3 /
 * max 10). Line height is read from computed styles so it tracks the font.
 */
export function AutoGrowTextArea({
  value,
  onChange,
  placeholder,
  minRows,
  maxRows,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minRows: number;
  maxRows: number;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const cs = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(cs.lineHeight) || 20;
    const padding = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
    const minHeight = minRows * lineHeight + padding;
    const maxHeight = maxRows * lineHeight + padding;
    el.style.height = 'auto';
    const next = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoCapitalize="sentences"
      rows={minRows}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
