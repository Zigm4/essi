import { useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppBackground } from '../design-system/components/AppBackground';
import { GlassCard } from '../design-system/components/GlassCard';
import { NeonButton } from '../design-system/components/NeonButton';
import {
  IconArrowForward,
  IconChevronRight,
  IconGridView,
  IconRocketLaunch,
  IconSatelliteAlt,
  IconShieldMoon,
  IconWifiTethering,
} from '../design-system/icons';
import { useReducedMotion } from '../design-system/reducedMotion';
import { useSettingsStore } from '../data/settings';
import styles from './Onboarding.module.css';

interface OnboardingPage {
  channel: string;
  icon: ReactNode;
  title: string;
  body: string;
  bullets: string[];
}

/** Exact copy from app-shell spec §6.2. */
const PAGES: OnboardingPage[] = [
  {
    channel: 'ESSI//WELCOME',
    icon: <IconSatelliteAlt size={22} />,
    title: 'What ESSI is',
    body: 'ESSI is an unofficial fan companion for UP55 — a pocket terminal for pilots.\n\nIt bundles the field tools, references and trackers you reach for mid-run into one offline-first console. No account, no sign-in — open it and it works.',
    bullets: [
      'Made by a player, for the UP55 community.',
      'Everything lives on-device and works offline.',
    ],
  },
  {
    channel: 'ESSI//TOOLKIT',
    icon: <IconGridView size={22} />,
    title: 'The tools & SL-sectors',
    body: 'The Tools deck holds the working kit — System Scan, Asteroid Analyzer, Mars Express alerts, the Fishing map and more. Captures, Hangar and the Knowledge core keep your notes and references close.\n\nThe ESSI banner up top reads out an SL-sector code (SL = star-lane): a scroll-driven coordinate that anchors where you are in the console. It is flavour, not a live position — no location is ever read.',
    bullets: [
      'Sector codes are cosmetic — nothing is tracked from them.',
      'Tabs along the bottom switch between decks.',
    ],
  },
  {
    channel: 'ESSI//PRIVACY',
    icon: <IconShieldMoon size={22} />,
    title: 'Privacy promise',
    body: 'ESSI has no backend operated by us and ships no telemetry or analytics SDK. Your data stays on your device.\n\nMost outbound network is opt-in (a Discord invite, System Scan, Discoveries, Tracker). Interactive maps are the exception: they download content from GitHub (Pages/Fastly + jsDelivr) at most once a day, on by default — you can switch that off in Settings. You own your data: back it up or move devices with a plain JSON export.',
    bullets: [
      'No backend. No telemetry. No ads.',
      'Maps fetch from GitHub by default — toggle in Settings › Maps.',
      'Full JSON export & import lives in Settings › Data.',
    ],
  },
];

/** First-run intro — three "incoming transmission" cards (/onboarding). */
export function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const setOnboardingSeen = useSettingsStore((s) => s.setOnboardingSeen);
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const isReplay = (location.state as { replay?: boolean } | null)?.replay === true;

  const finish = () => {
    // Done or Skip always persists onboardingSeen so the flow shows once.
    setOnboardingSeen(true);
    if (isReplay) {
      navigate(-1);
    } else {
      navigate('/tools', { replace: true });
    }
  };

  const next = () => {
    if (page < PAGES.length - 1) setPage(page + 1);
    else finish();
  };

  return (
    <div className={styles.screen}>
      <AppBackground>
        <div className={styles.column}>
          <div className={styles.topBar}>
            <span className={styles.topIcon}>
              <IconWifiTethering size={14} />
            </span>
            <span className={styles.topLabel}>INCOMING TRANSMISSION</span>
            <button type="button" className={styles.skip} aria-label="Skip intro" onClick={finish}>
              Skip
            </button>
          </div>

          <div
            className={styles.pagerViewport}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchStartX.current;
              touchStartX.current = null;
              const end = e.changedTouches[0]?.clientX;
              if (start === null || end === undefined) return;
              const delta = end - start;
              if (delta < -50 && page < PAGES.length - 1) setPage(page + 1);
              if (delta > 50 && page > 0) setPage(page - 1);
            }}
          >
            <div
              className={`${styles.pagerTrack} ${reduced ? styles.pagerInstant : ''}`}
              style={{ transform: `translateX(-${(page * 100) / 3}%)` }}
            >
              {PAGES.map((p) => (
                <div key={p.channel} className={styles.page}>
                  <GlassCard glow padding={16} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardHeaderIcon}>{p.icon}</span>
                      <span className={styles.channel}>{p.channel}</span>
                    </div>
                    <div className={styles.title}>{p.title}</div>
                    <div className={styles.body}>{p.body}</div>
                    <div className={styles.divider} />
                    <div className={styles.bullets}>
                      {p.bullets.map((b) => (
                        <div key={b} className={styles.bullet}>
                          <span className={styles.bulletIcon}>
                            <IconChevronRight size={16} />
                          </span>
                          <span className={styles.bulletText}>{b}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.dots}>
            {PAGES.map((p, i) => (
              <span key={p.channel} className={`${styles.dot} ${i === page ? styles.dotActive : ''}`} />
            ))}
          </div>

          <div className={styles.buttonRow}>
            {page < PAGES.length - 1 ? (
              <NeonButton title="Next" icon={<IconArrowForward size={18} />} onPressed={next} />
            ) : (
              <NeonButton
                title="Enter ESSI"
                icon={<IconRocketLaunch size={18} />}
                onPressed={next}
              />
            )}
          </div>
        </div>
      </AppBackground>
    </div>
  );
}
