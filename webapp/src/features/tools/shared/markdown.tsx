import { Fragment, type ReactNode } from 'react';
import styles from './markdown.module.css';

/**
 * Minimal markdown renderer for job description / on-complete text. The data
 * only ever contains bold (`**…**`) and inline code (`` `…` `` / ` ``…`` `),
 * plus the occasional fenced ``` block. Styling per spec §3.6: paragraphs body
 * 13/1.4, bold → weight 800 accentPrimary, inline code mono 12 accentSecondary
 * on bgDeepest, code blocks on bgDeepest radius 8.
 */

/** Strips ** and backticks and collapses newlines — used for list teasers. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenizes a run of inline text into bold / code / plain nodes. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let plainStart = 0;
  let n = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) nodes.push(<Fragment key={`${keyPrefix}-t${n++}`}>{text.slice(plainStart, end)}</Fragment>);
  };

  while (i < text.length) {
    // Bold **…**
    if (text.startsWith('**', i)) {
      const close = text.indexOf('**', i + 2);
      if (close !== -1) {
        flushPlain(i);
        nodes.push(
          <strong key={`${keyPrefix}-b${n++}`} className={styles.bold}>
            {text.slice(i + 2, close)}
          </strong>,
        );
        i = close + 2;
        plainStart = i;
        continue;
      }
    }
    // Inline code: double backtick first (may wrap single backticks), then single.
    if (text.startsWith('``', i)) {
      const close = text.indexOf('``', i + 2);
      if (close !== -1) {
        flushPlain(i);
        nodes.push(
          <code key={`${keyPrefix}-c${n++}`} className={styles.code}>
            {text.slice(i + 2, close).trim()}
          </code>,
        );
        i = close + 2;
        plainStart = i;
        continue;
      }
    }
    if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);
      if (close !== -1) {
        flushPlain(i);
        nodes.push(
          <code key={`${keyPrefix}-c${n++}`} className={styles.code}>
            {text.slice(i + 1, close)}
          </code>,
        );
        i = close + 1;
        plainStart = i;
        continue;
      }
    }
    i++;
  }
  flushPlain(text.length);
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  const blocks: ReactNode[] = [];
  // Split on fenced code blocks, keeping them as separate block elements.
  const parts = trimmed.split(/```/);
  parts.forEach((part, idx) => {
    const isFence = idx % 2 === 1;
    if (isFence) {
      blocks.push(
        <pre key={`f${idx}`} className={styles.codeBlock}>
          {part.replace(/^\n/, '').replace(/\n$/, '')}
        </pre>,
      );
      return;
    }
    // Non-fenced: split into paragraphs on blank lines.
    part
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .forEach((para, pIdx) => {
        blocks.push(
          <p key={`p${idx}-${pIdx}`} className={styles.paragraph}>
            {renderInline(para, `p${idx}-${pIdx}`)}
          </p>,
        );
      });
  });

  return <div className={styles.root}>{blocks}</div>;
}
