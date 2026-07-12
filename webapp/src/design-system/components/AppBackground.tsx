import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from '../reducedMotion';
import styles from './AppBackground.module.css';

/**
 * Full-screen stack wrapping every page (design-system spec §5):
 * solid #03060B + top-left cyan radial glow + 6% hex grid + optional
 * cyber particles + children + CRT scanlines overlay above content.
 */

/** HexGridPainter - flat-top hexagon tiling, exact algorithm from §5.2. */
function paintHexGrid(canvas: HTMLCanvasElement): void {
  const parent = canvas.parentElement;
  if (parent === null) return;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  if (width === 0 || height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.scale(dpr, dpr);

  const r = 18;
  const dy = (r * Math.sqrt(3)) / 2;
  ctx.strokeStyle = '#4FC3FF';
  ctx.lineWidth = 0.4;
  let row = 0;
  for (let y = -dy; y < height + dy; y += dy * 2, row++) {
    const xOffset = row % 2 === 0 ? 0 : r * 1.5;
    for (let x = -r + xOffset; x < width + r; x += r * 3) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

interface Particle {
  x: number;
  speed: number;
  radius: number;
  phase: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    speed: 0.18 + Math.random() * (0.55 - 0.18),
    radius: 0.6 + Math.random() * (2.4 - 0.6),
    phase: Math.random(),
  }));
}

/** CyberParticles painter - cyan dots drifting bottom → top (§5.4). */
function CyberParticles({ count = 28 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>(makeParticles(count));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let raf = 0;
    let running = true;
    const start = performance.now();

    const frame = (now: number) => {
      if (!running) return;
      const parent = canvas.parentElement;
      if (parent !== null) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
        if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx !== null) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, width, height);
          const t = (now - start) / 1000;
          for (const p of particlesRef.current) {
            let cycle = (t * p.speed + p.phase) % 1;
            if (cycle < 0) cycle += 1;
            const y = height * (1 - cycle);
            const opacity = Math.sin(cycle * Math.PI);
            ctx.fillStyle = `rgba(122, 227, 255, ${0.55 * opacity})`;
            ctx.beginPath();
            ctx.arc(p.x * width, y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particles} />;
}

export function AppBackground({
  showsParticles = false,
  showsScanlines = true,
  className,
  children,
}: {
  showsParticles?: boolean;
  showsScanlines?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const hexRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = hexRef.current;
    if (canvas === null) return;
    paintHexGrid(canvas);
    const observer = new ResizeObserver(() => paintHexGrid(canvas));
    if (canvas.parentElement !== null) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <canvas ref={hexRef} className={styles.hexGrid} />
      {showsParticles && !reduced && <CyberParticles />}
      <div className={styles.content}>{children}</div>
      {showsScanlines && <div className={styles.scanlines} />}
    </div>
  );
}
