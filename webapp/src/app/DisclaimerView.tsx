import { fandomUrl, gameCreator, gameTitle } from '../core/constants';
import { launchExternal } from '../core/externalLink';
import { GlassCard } from '../design-system/components/GlassCard';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import {
  IconInfoOutline,
  IconKnowledge,
  IconOpenInNew,
  IconPublic,
} from '../design-system/icons';
import styles from './DisclaimerView.module.css';

/** Disclaimer (/menu/disclaimer) — app-shell spec §11, exact copy. */
export function DisclaimerView() {
  return (
    <SubPage title="Disclaimer">
      <GlassCard>
        <div className={styles.headerRow}>
          <span className={styles.headerIcon}>
            <IconInfoOutline size={20} />
          </span>
          <span className={styles.headline}>Unofficial fan project</span>
        </div>
        <div className={styles.body}>
          Underdeck is an independent companion app made by a player for the UP55 community.
        </div>
        <div className={styles.body}>
          It is not affiliated with, endorsed by, or sponsored by the creator of Underpunks55.
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Credits" />
        <div className={styles.body}>{`${gameTitle} is created by ${gameCreator}.`}</div>
        <div className={styles.body}>
          All in-game terminology, lore, zone names and bot commands referenced in this app belong
          to the original creators. Underdeck only mirrors information that is freely visible in
          the public Discord bot.
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Community resources" icon={<IconKnowledge size={18} />} />
        <div className={styles.body}>
          The Underpunks Fandom wiki is a community-maintained reference for UP55 lore, zones and
          game mechanics.
        </div>
        <button type="button" className={styles.linkRow} onClick={() => launchExternal(fandomUrl)}>
          <span className={styles.linkIcon}>
            <IconOpenInNew size={16} />
          </span>
          <span className={styles.linkText}>underpunks.fandom.com</span>
        </button>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Map content & updates" icon={<IconPublic size={18} />} />
        <div className={styles.body}>
          Interactive maps are downloaded from GitHub — GitHub Pages (fronted by Fastly) for the
          version pointer and jsDelivr (with raw.githubusercontent.com as a fallback) for the
          files — at most once a day, and verified by SHA-256 before use. A built-in sample map
          ships with the app so maps work offline. Downloads are on by default and can be turned
          off, or cleared, in Settings › Interactive maps.
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Trademarks & assets" />
        <div className={styles.body}>
          The names "Underpunks55", "UP55", "East-Shire" and any related visual assets are the
          property of their respective owners. Underdeck uses no in-game art assets, only original
          UI elements built from scratch.
        </div>
      </GlassCard>
    </SubPage>
  );
}
