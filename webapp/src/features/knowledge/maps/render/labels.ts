/**
 * Shared label drawing (maps spec §13.1/§14.6/§15): a legibility scrim plus
 * up-to-two lines of centered, ellipsized text. The scrim is the engine's
 * non-bypassable legibility guarantee (theme.background @ 0.72).
 */

import type { MapTheme } from '../model/theme';
import { paintLabelScrim } from './paintOps';

const LINE_HEIGHT = 1.05;

function wrapTwoLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 1) break;
    }
  }
  if (lines.length < 2) lines.push(current);
  // Ellipsize the last line if still too wide.
  let last = lines[lines.length - 1];
  if (ctx.measureText(last).width > maxWidth) {
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.slice(0, 2);
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
