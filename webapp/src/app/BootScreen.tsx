import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../design-system/components/AppBackground';
import { BootTerminalText } from '../design-system/components/BootTerminalText';
import { useReducedMotion } from '../design-system/reducedMotion';
import { useSettingsStore } from '../data/settings';
import { BootEmblem } from './BootEmblem';
import { bootMode, storedFastBootChoice } from './bootMode';
import styles from './BootScreen.module.css';

/** Boot lines - exact copy, typed in order (app-shell spec §5.2). */
const BOOT_LINES = [
  '> initializing ESSI subsystems…',
  '> linking local datastore…',
  '> indexing knowledge core…',
  '> calibrating ESSI scanners…',
  '> verifying drive nodes…',
  '> loading hangar registry…',
  '> spooling cargo manifest…',
  '> mounting Rankle River grid…',
  '> syncing pilot codex…',
  '> ready.',
];

const HOLD_AFTER_TEXT_MS = 1600;
const EXIT_FADE_MS = 550;
const FAST_BOOT_FADE_MS = 180;

/**
 * Cyberpunk console boot splash (/boot). The full intro plays on the first
 * launch (or every launch with Fast boot turned off); otherwise the splash
 * fades straight out. Tap anywhere skips immediately.
 */
export function BootScreen() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  // Decided once per launch: storing the default on exit must not change this boot.
  const [fast] = useState(
    () =>
      bootMode({
        fastBootChoice: storedFastBootChoice(),
        onboardingSeen: useSettingsStore.getState().onboardingSeen,
      }) === 'fast',
  );
  const [exiting, setExiting] = useState(false);
  const [textDone, setTextDone] = useState(false);
  const exitStartedRef = useRef(false);
  const fadeMs = fast || reduced ? FAST_BOOT_FADE_MS : EXIT_FADE_MS;

  const beginExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    // Intro seen or skipped: with no choice made yet, store the default (on) so later
    // launches are fast and Settings shows it.
    if (storedFastBootChoice() === null) useSettingsStore.getState().setFastBoot(true);
    setExiting(true);
    setTimeout(() => {
      const seen = useSettingsStore.getState().onboardingSeen;
      navigate(seen ? '/tools' : '/onboarding', { replace: true });
    }, fadeMs);
  }, [navigate, fadeMs]);

  // Fast boot: begin exit on the first frame with the shorter fade.
  useEffect(() => {
    if (fast) beginExit();
  }, [fast, beginExit]);

  // Text finished → hold 1600ms → exit.
  useEffect(() => {
    if (!textDone) return;
    const timer = setTimeout(beginExit, HOLD_AFTER_TEXT_MS);
    return () => clearTimeout(timer);
  }, [textDone, beginExit]);

  return (
    <div
      className={`${styles.screen} ${exiting ? styles.exiting : ''}`}
      style={{ transitionDuration: `${fadeMs}ms` }}
      onClick={beginExit}
      role="button"
      aria-label="Skip intro"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') beginExit();
      }}
    >
      <AppBackground showsParticles>
        <div className={styles.column}>
          {!reduced && <div className={styles.scanBeam} />}
          <BootEmblem />
          <div className={styles.wordmark}>ESSI</div>
          <div className={styles.subline}>UP55 FAN COMPANION</div>
          <div className={styles.spacer} />
          <div className={styles.terminalCard}>
            <div className={styles.trafficRow}>
              <span className={styles.trafficDot} style={{ background: '#FF5F57' }} />
              <span className={styles.trafficDot} style={{ background: '#FEBC2E' }} />
              <span className={styles.trafficDot} style={{ background: '#28C840' }} />
              <span className={styles.bootLabel}>essi://boot</span>
            </div>
            <BootTerminalText lines={BOOT_LINES} onComplete={() => setTextDone(true)} />
          </div>
          {/* Shown from the start: the intro continues on its own, a tap only skips it. */}
          <div className={styles.hint}>tap to skip</div>
        </div>
      </AppBackground>
    </div>
  );
}
