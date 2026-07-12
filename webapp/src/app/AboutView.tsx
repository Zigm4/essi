import { versionFullLabel } from '../core/version';
import { GlassCard } from '../design-system/components/GlassCard';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import { IconCheckCircle, IconLock } from '../design-system/icons';
import styles from './AboutView.module.css';

const PRIVACY_BULLETS = [
  'Free forever. No ads, no IAP.',
  'No telemetry. No analytics SDK.',
  'No backend operated by us. Data stays on your device.',
  'Most outbound network is opt-in (Discord invite, System Scan, Discoveries, Tracker).',
  'Interactive maps download from GitHub (Pages/Fastly + jsDelivr), at most once a day. On by default - turn it off in Settings › Interactive maps.',
];

const OFL_FONTS = [
  { name: 'Inter', file: 'Inter-OFL.txt' },
  { name: 'JetBrains Mono', file: 'JetBrainsMono-OFL.txt' },
  { name: 'Quicksand', file: 'Quicksand-OFL.txt' },
];

/** About (/menu/about) - app-shell spec §9 + web licenses note. */
export function AboutView() {
  return (
    <SubPage title="About">
      <GlassCard>
        <div className={styles.wordmark}>ESSI</div>
        <div className={styles.version}>{versionFullLabel}</div>
        <div className={styles.divider} />
        <div className={styles.body}>Made by a player, for the UP55 community.</div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Privacy at a glance" icon={<IconLock size={18} />} />
        <div className={styles.bullets}>
          {PRIVACY_BULLETS.map((line) => (
            <div key={line} className={styles.bulletRow}>
              <span className={styles.bulletIcon}>
                <IconCheckCircle size={16} />
              </span>
              <span className={styles.body}>{line}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Licenses" />
        <div className={styles.bullets}>
          <div className={styles.body}>
            ESSI bundles the Inter, JetBrains Mono and Quicksand typefaces, each licensed
            under the SIL Open Font License.
          </div>
          <div className={styles.licenseRow}>
            {OFL_FONTS.map((font) => (
              <a
                key={font.name}
                className={styles.licenseLink}
                href={`${import.meta.env.BASE_URL}fonts/${font.file}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {font.name} OFL
              </a>
            ))}
          </div>
        </div>
      </GlassCard>
    </SubPage>
  );
}
