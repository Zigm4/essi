/**
 * Shared canvas-2D zone paint ops (maps spec §13.3), used by the flat, globe
 * and grid renderers so every representation shares one neon visual system.
 * Gaussian blur is emulated with `ctx.filter = blur(px)`; where unsupported the
 * strokes still render (just un-blurred).
 */

import { colorAlpha, type MapTheme } from '../model/theme';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Zone stroke width in the drawing space (§13.3). */
export function zoneStrokeWidth(shortestSide: number): number {
  const w = shortestSide * 0.003;
  return w < 2 ? 2 : w > 14 ? 14 : w;
}

function withFilter(ctx: CanvasRenderingContext2D, blurPx: number, draw: () => void): void {
  const prev = ctx.filter;
  try {
    ctx.filter = `blur(${blurPx}px)`;
  } catch {
    // ctx.filter unsupported - render un-blurred.
  }
  draw();
  ctx.filter = prev;
}

/** Fill + neon glow + crisp outline for a polygon zone (even-odd path). */
export function paintPolygonZone(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  theme: MapTheme,
  strokeWidth: number,
  selected: boolean,
): void {
  // 1. Fill.
  ctx.fillStyle = colorAlpha(selected ? theme.zoneSelectedFill : theme.zoneFill, selected ? 0.6 : 0.42);
  ctx.fill(path, 'evenodd');

  // 2. Neon glow (blurred stroke under the crisp one).
  const glowW = strokeWidth * (selected ? 1.8 : 1.3);
  const glowSigma = strokeWidth * (selected ? 2.4 : 1.5);
  withFilter(ctx, glowSigma, () => {
    ctx.lineWidth = glowW;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorAlpha(theme.glow, selected ? 0.9 : 0.5);
    ctx.stroke(path);
  });

  // 3. Crisp outline.
  ctx.lineWidth = strokeWidth * (selected ? 1.4 : 1.0);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colorAlpha(theme.zoneStroke, 1);
  ctx.stroke(path);
}

/** Glow disc + solid disc + ring + inner cut-out for a marker zone. */
export function paintMarkerZone(
  ctx: CanvasRenderingContext2D,
  center: Pt,
  radius: number,
  theme: MapTheme,
  selected: boolean,
): void {
  const r = radius;
  // 1. Glow disc.
  withFilter(ctx, r * 0.6, () => {
    ctx.beginPath();
    ctx.arc(center.x, center.y, r * (selected ? 1.5 : 1.2), 0, Math.PI * 2);
    ctx.fillStyle = colorAlpha(theme.glow, selected ? 0.9 : 0.5);
    ctx.fill();
  });
  // 2. Solid disc.
  ctx.beginPath();
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
  ctx.fillStyle = colorAlpha(selected ? theme.zoneSelectedFill : theme.accent, 1);
  ctx.fill();
  // 3. Ring stroke.
  ctx.lineWidth = r * 0.18;
  ctx.strokeStyle = colorAlpha(theme.zoneStroke, 1);
  ctx.stroke();
  // 4. Inner cut-out.
  ctx.beginPath();
  ctx.arc(center.x, center.y, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = colorAlpha(theme.background, 1);
  ctx.fill();
}

/** The engine-guaranteed legibility scrim (theme.background @ 0.72). */
export function paintLabelScrim(
  ctx: CanvasRenderingContext2D,
  theme: MapTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  const r = Math.min(radius, w / 2, h / 2);
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = colorAlpha(theme.background, 0.72);
  ctx.fill();
}
