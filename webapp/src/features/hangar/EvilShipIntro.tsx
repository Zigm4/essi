import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../design-system/reducedMotion';
import { IconCancel, IconDirectionsBoat } from './hangarIcons';
import styles from './hangar.module.css';

/**
 * Fullscreen "captain's log" easter egg for the EVIL void ship (spec §8).
 * A Star-Wars-style crawl over a starfield, resolving into a decorative void
 * portal. The portal is the sanctioned simpler CSS re-interpretation (spec §8.3).
 */

/** Verbatim log text (spec §8.2). Blank strings render as spacers; `//` lines are dim comments. */
const LOG_LINES: string[] = [
  "// captain's log, uncertified channel",
  '// origin: somewhere astern of the present',
  '',
  'I am Captain GreyWhisker.',
  '',
  'If this transmission reaches your console, you have already brushed against the void. That is not a threat. That is just how she introduces herself.',
  '',
  'The vessel you are about to register is no Solstice, no Ratship. It is the Lawless: the only EVIL hull ever laid down at the East-Shire docks. There were others. The records of them have been politely forgotten.',
  '',
  'She does not move the way ships move. She is not pulled by gravity, she is invited by it. She does not warm her hull on a star, she remembers being warm. The instruments lie about her, and the instruments are not at fault.',
  '',
  'I have steered her through three Marses now. Two of them were ours. One belonged to an East-Shire that took a different vote, in a year you will never live in. The crew there were kind. The food was strange. We did not stay.',
  '',
  'She will tell you, in her quiet way, that she has been to places this companion app does not list. Coastal towns under Phobos. A trade route to a Ceres that survived. The Imperious Falls running upward, slowly, against a sky that had given up on being blue.',
  '',
  'She has no pilot. She has no gunner. She does not need a quartermaster, because what we bring back is rarely the same shape as what we left with.',
  '',
  'If you mean to keep her in your hangar, understand this: she is registered to East-Shire and to East-Shire alone. She answers no captain. She answers a question I no longer remember asking.',
  '',
  'When you close this log, your console will show what little can honestly be said about her. Matricule EVIL-01. Ownership East-Shire. Attached to the void docks. The other fields will fall quiet. They are not broken. They are simply not for you to fill in.',
  '',
  'Take care out there.',
  '',
  'GreyWhisker, somewhere off the chart.',
];

const CRAWL_MS = 110_000;
const PORTAL_MS = 4000;
const PORTAL_MS_REDUCED = 600;

/** Deterministic PRNG (mulberry32) so the starfield matches the spec's fixed seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

type Phase = 'scrolling' | 'fading' | 'portal';

export function EvilShipIntro({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('scrolling');
  const crawlRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(42);
    return Array.from({ length: 70 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.8 + rand() * 1.6,
      o: 0.25 + rand() * 0.6,
    }));
  }, []);

  // Crawl driver (spec §8.2): translate the log from 85% of the viewport to
  // just above the top over 110s, then trigger the portal.
  useEffect(() => {
    const crawl = crawlRef.current;
    const viewport = viewportRef.current;
    if (crawl === null || viewport === null) return;

    const startY = viewport.clientHeight * 0.85;
    const endY = -(crawl.scrollHeight + 40);

    if (reduced) {
      crawl.style.transform = `translateY(${endY}px)`;
      const id = window.requestAnimationFrame(() => setPhase('fading'));
      return () => window.cancelAnimationFrame(id);
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / CRAWL_MS);
      crawl.style.transform = `translateY(${startY - progress * (startY - endY)}px)`;
      if (progress >= 1) {
        setPhase('fading');
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [reduced]);

  // Once fading starts, settle the portal after its animation completes.
  useEffect(() => {
    if (phase !== 'fading') return;
    const duration = reduced ? PORTAL_MS_REDUCED : PORTAL_MS;
    const id = window.setTimeout(() => setPhase('portal'), duration);
    return () => window.clearTimeout(id);
  }, [phase, reduced]);

  const textHidden = phase !== 'scrolling';
  const portalActive = phase === 'fading' || phase === 'portal';

  return (
    <div className={styles.evilRoot} role="dialog" aria-label="Void ship log">
      <div
        ref={viewportRef}
        className={`${styles.starfield} ${textHidden ? styles.starfieldDim : ''}`}
      >
        {stars.map((star, i) => (
          <span
            key={i}
            className={`${styles.star} ${reduced ? '' : styles.starDrift}`}
            style={{
              left: `${star.x * 100}%`,
              top: `${star.y * 100}%`,
              width: star.r * 2,
              height: star.r * 2,
              opacity: star.o,
            }}
          />
        ))}
      </div>

      {portalActive && (
        <div
          className={`${styles.portal} ${phase === 'portal' ? styles.portalSettled : ''} ${
            reduced ? styles.portalReduced : ''
          }`}
          aria-hidden="true"
        >
          <div className={styles.portalHalo} />
          <div className={styles.portalCorona} />
          <div className={styles.portalAqua} />
          <div className={styles.portalMantle} />
          <div className={styles.portalCore} />
          <div className={styles.portalGlints} />
        </div>
      )}

      <div className={styles.evilColumn}>
        <div className={`${styles.evilText} ${textHidden ? styles.evilTextHidden : ''}`}>
          <div className={styles.evilHeader}>
            <span className={styles.evilHeaderRow}>
              <IconDirectionsBoat size={22} />
              <span className={styles.evilTitle}>VOID SHIP</span>
            </span>
            <span className={styles.evilSubtitle}>
              EAST-SHIRE VESSEL INDUSTRIES . LAWLESS . EVIL-01
            </span>
          </div>

          <div className={styles.crawlViewport}>
            <div ref={crawlRef} className={styles.crawlContent}>
              {LOG_LINES.map((line, i) => {
                if (line === '') return <div key={i} className={styles.crawlSpacer} />;
                if (line.startsWith('//'))
                  return (
                    <div key={i} className={styles.crawlComment}>
                      {line}
                    </div>
                  );
                return (
                  <p key={i} className={styles.crawlParagraph}>
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.evilFooter}>
          {phase === 'scrolling' && (
            <div className={styles.evilHint}>She'll wait. So will the rest of the form.</div>
          )}
          <button type="button" className={styles.evilClose} onClick={onClose}>
            <IconCancel size={18} />
            {phase === 'portal' ? 'Step through' : 'Close log'}
          </button>
        </div>
      </div>
    </div>
  );
}
