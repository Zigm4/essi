import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { discordInviteUrl } from '../core/constants';
import { launchExternal } from '../core/externalLink';
import { Haptics } from '../core/haptics';
import { versionShortLabel } from '../core/version';
import { BannerPage } from '../design-system/components/BannerPage';
import { GlassCard } from '../design-system/components/GlassCard';
import { PageScrollView } from '../design-system/components/PageScrollView';
import { BannerAction } from '../design-system/components/TransmissionHeader';
import {
  IconChevronRight,
  IconForum,
  IconHelpOutline,
  IconInfoOutline,
  IconMailOutline,
  IconOpenInNew,
  IconSearch,
  IconSparkle,
  IconTune,
} from '../design-system/icons';
import styles from './MenuView.module.css';

function MenuRow({
  title,
  subtitle,
  icon,
  external = false,
  onTap,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  external?: boolean;
  onTap: () => void;
}) {
  return (
    <GlassCard onTap={onTap} ariaLabel={`${title}. ${subtitle}`}>
      <span className={styles.row}>
        <span className={styles.iconSlot}>{icon}</span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
        <span className={styles.chevron}>
          {external ? <IconOpenInNew size={20} /> : <IconChevronRight size={20} />}
        </span>
      </span>
    </GlassCard>
  );
}

/** Menu tab (/menu) — app-shell spec §7. */
export function MenuView() {
  const navigate = useNavigate();
  return (
    <BannerPage
      bannerLabel="ESSI · Operator Support"
      bannerActions={
        <BannerAction
          label="Search"
          onTap={() => {
            Haptics.tap();
            navigate('/menu/search');
          }}
        >
          <IconSearch size={20} />
        </BannerAction>
      }
    >
      <PageScrollView padding="12px 12px 32px">
        <div className={styles.stack}>
          <MenuRow
            title="Search"
            subtitle="Maps, KB, jobs, wallets, notes"
            icon={<IconSearch size={22} />}
            onTap={() => navigate('/menu/search')}
          />
          <MenuRow
            title="Settings"
            subtitle="Animations · haptics"
            icon={<IconTune size={22} />}
            onTap={() => navigate('/menu/settings')}
          />
          <MenuRow
            title="FAQ"
            subtitle="Free, local, private, the rules."
            icon={<IconHelpOutline size={22} />}
            onTap={() => navigate('/menu/faq')}
          />
          <MenuRow
            title="Contact"
            subtitle="Feedback, bug reports, support"
            icon={<IconMailOutline size={22} />}
            onTap={() => navigate('/menu/contact')}
          />
          <MenuRow
            title="Join Discord"
            subtitle="UP55 community invite"
            icon={<IconForum size={22} />}
            external
            onTap={() => launchExternal(discordInviteUrl)}
          />
          <MenuRow
            title="Disclaimer"
            subtitle="Unofficial fan project · made for the UP55 community"
            icon={<IconInfoOutline size={22} />}
            onTap={() => navigate('/menu/disclaimer')}
          />
          <MenuRow
            title="About"
            subtitle={`${versionShortLabel} (Alpha)`}
            icon={<IconSparkle size={22} />}
            onTap={() => navigate('/menu/about')}
          />
        </div>
      </PageScrollView>
    </BannerPage>
  );
}
