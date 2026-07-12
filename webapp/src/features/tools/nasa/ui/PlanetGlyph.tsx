import { useEffect, useRef } from 'react';
import { withAlpha } from '../../../../design-system/color';
import { useReducedMotion } from '../../../../design-system/reducedMotion';
import type { GlyphColors } from '../planets';

/**
 * Decorative per-planet glyph (spec §4.3): halo + body gradient + glow +
 * border, an optional Saturn ring, and an animated scan arc. Renders a static
 * mid-state (no pulsing, no arc) when reduced motion is requested or when
 * `staticGlyph` is set (share cards / history detail).
 */

const BOX = 32;
const TWO_PI = Math.PI * 2;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  glyph: GlyphColors;
  hasRing: boolean;
  index: number;
  now: number;
  animate: boolean;
}

function drawGlyph({ ctx, glyph, hasRing, index, now, animate }: DrawArgs): void {
  const cx = BOX / 2;
  const cy = BOX / 2;
  const d = glyph.diameter;
  ctx.clearRect(0, 0, BOX, BOX);

  // 1. Halo (pulsing scale 0.85→1.0, opacity 1.0→0.55; static uses mid-state).
  const hp = animate ? easeInOut(Math.abs(((now / 1600) % 2) - 1)) : 0.5;
  const haloScale = 0.85 + hp * 0.15;
  const haloOpacity = 1 - hp * 0.45;
  const haloRadius = 16 * haloScale;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
  grad.addColorStop(0, withAlpha(glyph.light, 0.55 * haloOpacity));
  grad.addColorStop(1, withAlpha(glyph.light, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, TWO_PI);
  ctx.fill();

  // 5. Saturn ring (behind the body).
  if (hasRing) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-22 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, (d * 1.85) / 2, (d * 0.5) / 2, 0, 0, TWO_PI);
    ctx.strokeStyle = withAlpha(glyph.light, 0.5);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(glyph.dark, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Body - TL→BR linear gradient.
  const bodyGrad = ctx.createLinearGradient(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2);
  bodyGrad.addColorStop(0, glyph.light);
  bodyGrad.addColorStop(1, glyph.dark);

  // 3. Glow (same circle, blurred).
  ctx.save();
  ctx.shadowColor = withAlpha(glyph.light, 0.55);
  ctx.shadowBlur = 2;
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  // 4. Border.
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 6. Scan arc (animated only).
  if (animate) {
    const phase = index * 0.41 * (Math.PI / 2);
    const start = (now / 4500) * TWO_PI + phase;
    const sweep = 0.18 * TWO_PI;
    ctx.save();
    ctx.shadowColor = glyph.scan;
    ctx.shadowBlur = 1.5;
    ctx.strokeStyle = glyph.scan;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, (d + 5) / 2, start, start + sweep);
    ctx.stroke();
    ctx.restore();
  }
}

export function PlanetGlyph({
  glyph,
  hasRing,
  index,
  staticGlyph = false,
}: {
  glyph: GlyphColors;
  hasRing: boolean;
  index: number;
  staticGlyph?: boolean;
}) {
  const reduced = useReducedMotion();
  const animate = !staticGlyph && !reduced;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(BOX * dpr);
    canvas.height = Math.round(BOX * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.scale(dpr, dpr);

    if (!animate) {
      drawGlyph({ ctx, glyph, hasRing, index, now: 0, animate: false });
      return;
    }
    let raf = 0;
    let running = true;
    const frame = (now: number) => {
      if (!running) return;
      drawGlyph({ ctx, glyph, hasRing, index, now, animate: true });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [glyph, hasRing, index, animate]);

  return <canvas ref={canvasRef} style={{ width: BOX, height: BOX, flex: 'none' }} aria-hidden="true" />;
}
