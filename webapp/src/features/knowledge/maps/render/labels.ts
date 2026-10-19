/**
 * Shared label drawing (maps spec §13.1/§14.6/§15): a legibility scrim plus
 * up-to-two lines of centered, ellipsized text. The scrim is the engine's
 * non-bypassable legibility guarantee (theme.background @ 0.72).
 */

import type { MapTheme } from '../model/theme';
import { paintLabelScrim } from './paintOps';

const LINE_HEIGHT = 1.05;

/** What the wrapping needs from a canvas context (lets tests pass a fake). */
type TextMeasurer = Pick<CanvasRenderingContext2D, 'measureText'>;

/** `text` cut to fit `maxWidth` with a trailing `…`, or `text` itself when it fits. */
function ellipsize(ctx: TextMeasurer, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  // Binary search for the longest prefix that fits with its ellipsis (a cell
  // name is painted every frame, so this stays O(log n) measures).
  let lo = 1;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/**
 * Wrap `text` onto at most two lines of `maxWidth`: the first line takes as
 * many whole words as fit, the second takes ALL the rest. Whatever doesn't fit
 * is cut with `…`, so a label is never shortened without showing it. A lone
 * word wider than a line is ellipsized on its own line.
 */
export function wrapTwoLines(ctx: TextMeasurer, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const whole = words.join(' ');
  if (ctx.measureText(whole).width <= maxWidth) return [whole];
  let first = words[0];
  let next = 1;
  while (next < words.length && ctx.measureText(`${first} ${words[next]}`).width <= maxWidth) {
    first = `${first} ${words[next]}`;
    next += 1;
  }
  if (next === words.length) return [ellipsize(ctx, first, maxWidth)]; // one over-wide word
  return [ellipsize(ctx, first, maxWidth), ellipsize(ctx, words.slice(next).join(' '), maxWidth)];
}

/** Draw a centered label (scrim + glyphs) at (cx, cy). */
export function drawCenteredLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  theme: MapTheme,
  fontSize: number,
  yShift = 0,
): void {
  ctx.font = `600 ${fontSize}px "${theme.fontFamily}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = fontSize * 12;
  const lines = wrapTwoLines(ctx, text, maxWidth);
  let blockWidth = 0;
  for (const l of lines) blockWidth = Math.max(blockWidth, ctx.measureText(l).width);
  const lineH = fontSize * LINE_HEIGHT;
  const blockHeight = lines.length * lineH;
  const centerY = cy + yShift;

  const padX = 0.45 * fontSize;
  const padY = 0.28 * fontSize;
  const radius = 0.5 * fontSize;
  paintLabelScrim(
    ctx,
    theme,
    cx - blockWidth / 2 - padX,
    centerY - blockHeight / 2 - padY,
    blockWidth + padX * 2,
    blockHeight + padY * 2,
    radius,
  );

  ctx.fillStyle = `rgba(${theme.label.r}, ${theme.label.g}, ${theme.label.b}, 1)`;
  const startY = centerY - blockHeight / 2 + lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineH));
}
