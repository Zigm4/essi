/**
 * "How interactive maps work" sheet content (maps spec §12.4) — exact copy.
 * Rendered inside the design-system <HowItWorksSheet>.
 */

import { InfoCard } from '../../../../design-system/components/InfoCard';
import { SectionHeader } from '../../../../design-system/components/SectionHeader';
import { KvRow } from '../../../../design-system/components/InfoRows';
import {
  IconDownload,
  IconLock,
  IconMap,
  IconShield,
  IconTune,
  IconWifiTethering,
} from '../../../../design-system/icons';
import { IconLink } from '../../kbIcons';
import styles from './MapsHowItWorks.module.css';

export function MapsHowItWorks() {
  return (
    <div className={styles.wrap}>
      <div className={styles.banner}>INTERACTIVE MAPS · how this works</div>

      <InfoCard className={styles.card}>
        <SectionHeader title="Overview" icon={<IconMap size={18} />} />
        <p className={styles.body}>
          Interactive maps are content — JSON geometry, field data, and images — not code. They are
          authored in a public GitHub repository and delivered to the app as plain data. The app ships
          with a small bundled set so maps work on first launch with no network at all; anything newer
          is fetched on top of that baseline.
        </p>
        <p className={styles.caption}>
          Nothing about your game state, identity, or usage is ever sent. The map pipeline only ever
          pulls public files down.
        </p>
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="Where maps come from" icon={<IconLink size={18} />} />
        <p className={styles.body}>
          Two layers. A tiny mutable pointer says "the current maps are at tag X". The actual content
          lives at that immutable, tag-pinned tag and is served from a multi-CDN mirror of the GitHub
          repo.
        </p>
        <KvRow
          label="Pointer"
          value="GitHub Pages (fronted by Fastly). Small JSON, polled with an ETag so an unchanged pointer is a 304 with no body."
          labelWidth={96}
        />
        <KvRow
          label="Content"
          value="jsDelivr — a multi-CDN (Cloudflare / Fastly / Bunny) mirror of the repo, pinned to an exact tag so bytes never change under a version."
          labelWidth={96}
        />
        <KvRow
          label="Fallback"
          value="raw.githubusercontent.com, used only if jsDelivr fails."
          labelWidth={96}
        />
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="Integrity" icon={<IconShield size={18} />} />
        <p className={styles.body}>
          Every document and image is pinned to a sha256 hash in the manifest. A downloaded file is
          verified against that hash before it is written to disk — a mismatch is rejected and the
          previously installed maps are kept untouched.
        </p>
        <p className={styles.caption}>
          Downloads are size-capped and streamed, so an oversized file is aborted mid-transfer rather
          than buffered whole. Because files are stored by their hash, an unchanged image across
          versions is reused for free — never re-downloaded.
        </p>
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="How often it checks" icon={<IconDownload size={18} />} />
        <KvRow label="Cadence" value="At most once every 24 hours, and only when you open the maps gallery." labelWidth={96} />
        <KvRow
          label="Trigger"
          value="Opening Interactive maps. No background timers, no push, no polling while the app is closed."
          labelWidth={96}
        />
        <KvRow
          label="Apply"
          value="A newer pack installs quietly and appears the next time you open maps — never swapped out mid-view."
          labelWidth={96}
        />
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="Works offline" icon={<IconWifiTethering size={18} />} />
        <p className={styles.body}>
          A seed set of maps is bundled inside the app binary and imported locally on first use — no
          network required. Rendering always reads from the on-device store, never the network, so maps
          stay fully usable on a plane, underground, or with downloads turned off.
        </p>
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="What leaves the device" icon={<IconLock size={18} />} />
        <KvRow label="Sent" value="Plain HTTP GET requests for public map files. No account, no device id, no analytics, no game data." labelWidth={96} />
        <KvRow
          label="Visible"
          value="Your IP address — the same thing any web request exposes — to the CDNs serving the files (GitHub / Fastly / jsDelivr)."
          labelWidth={96}
        />
        <KvRow label="Stored remotely" value="Nothing. There is no ESSI server." labelWidth={96} />
        <KvRow
          label="Stored locally"
          value="The downloaded map files, in the app support directory. Clear them any time from Settings."
          labelWidth={96}
        />
      </InfoCard>

      <InfoCard className={styles.card}>
        <SectionHeader title="Your control" icon={<IconTune size={18} />} />
        <p className={styles.body}>
          Map downloads are on by default so you get the latest content. You can turn them off entirely.
        </p>
        <KvRow
          label="Off-switch"
          value={'Settings → Interactive maps → "Download interactive maps". Off keeps only what is already on your device.'}
          labelWidth={96}
        />
        <KvRow
          label="Auto-update"
          value="A separate toggle for the once-a-day background check; turn it off to update only when you choose."
          labelWidth={96}
        />
        <KvRow
          label="Storage"
          value="Settings shows the installed version and size, with a Clear action that keeps the bundled seed usable."
          labelWidth={96}
        />
      </InfoCard>
    </div>
  );
}
