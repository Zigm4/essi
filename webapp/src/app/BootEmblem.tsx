import { useReducedMotion } from '../design-system/reducedMotion';
import styles from './BootScreen.module.css';

/** Regular hexagon path, flat orientation, first vertex at top (spec §5.4). */
function hexagonPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 90) * (Math.PI / 180);
    points.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `M${points.join('L')}Z`;
}

/** Boot emblem 220×220 — static rings under reduced motion, five loops otherwise. */
export function BootEmblem() {
  const reduced = useReducedMotion();
  const c = 110;
  const scanCircumference = 2 * Math.PI * 70;

  return (
    <svg className={styles.emblem} viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <linearGradient id="boot-core" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7AE3FF" />
          <stop offset="100%" stopColor="#4FC3FF" />
        </linearGradient>
        <radialGradient id="boot-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4FC3FF" stopOpacity="1" />
          <stop offset="100%" stopColor="#4FC3FF" stopOpacity="0" />
        </radialGradient>
        <filter id="boot-blur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {reduced ? (
        <>
          <circle cx={c} cy={c} r={100} stroke="rgba(122,227,255,0.12)" strokeWidth={1} fill="none" />
          <circle cx={c} cy={c} r={70} stroke="rgba(79,195,255,0.4)" strokeWidth={1} fill="none" />
          <circle cx={c} cy={c} r={45} stroke="rgba(122,227,255,0.5)" strokeWidth={1} fill="none" />
        </>
      ) : (
        <>
          {/* Outer dashed ring, counter-clockwise 14s, with 4 rim ticks. */}
          <g className={styles.rotateCcw14}>
            <circle
              cx={c}
              cy={c}
              r={100}
              stroke="rgba(122,227,255,0.12)"
              strokeWidth={1}
              strokeDasharray="3 7"
              fill="none"
            />
            <rect x={c - 0.5} y={6} width={1} height={8} fill="rgba(79,195,255,0.55)" />
            <rect x={c - 0.5} y={206} width={1} height={8} fill="rgba(79,195,255,0.55)" />
            <rect x={6} y={c - 0.5} width={8} height={1} fill="rgba(79,195,255,0.55)" />
            <rect x={206} y={c - 0.5} width={8} height={1} fill="rgba(79,195,255,0.55)" />
          </g>
          {/* Static ring Ø140. */}
          <circle cx={c} cy={c} r={70} stroke="rgba(79,195,255,0.18)" strokeWidth={1} fill="none" />
          {/* Scan arc on the Ø140 ring, clockwise 4.5s, ~22% sweep, blurred. */}
          <g className={styles.rotateCw45}>
            <circle
              cx={c}
              cy={c}
              r={70}
              stroke="#4FC3FF"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeDasharray={`${scanCircumference * 0.22} ${scanCircumference * 0.78}`}
              fill="none"
              filter="url(#boot-blur)"
            />
          </g>
          {/* Inner dashed ring, clockwise 8s. */}
          <g className={styles.rotateCw8}>
            <circle
              cx={c}
              cy={c}
              r={45}
              stroke="rgba(122,227,255,0.5)"
              strokeWidth={0.7}
              strokeDasharray="2 4"
              fill="none"
            />
          </g>
          {/* Pulsing radial glow disc Ø120 behind the core. */}
          <circle className={styles.pulseGlowDisc} cx={c} cy={c} r={60} fill="url(#boot-glow)" />
        </>
      )}

      {/* Core hexagon 56×56 with "ES". */}
      <g className={reduced ? undefined : styles.pulseCore}>
        <path
          d={hexagonPath(c, c, 28)}
          fill="url(#boot-core)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={0.8}
          style={{ filter: 'drop-shadow(0 0 12px rgba(79,195,255,0.7))' }}
        />
        <text
          x={c}
          y={c + 6}
          textAnchor="middle"
          fontFamily="var(--font-rounded)"
          fontSize={18}
          fontWeight={900}
          letterSpacing={2}
          fill="#03060B"
        >
          ES
        </text>
      </g>
    </svg>
  );
}
