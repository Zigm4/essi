import { useNavigate } from 'react-router-dom';
import { BannerPage } from '../../design-system/components/BannerPage';
import { ConsoleReveal } from '../../design-system/components/AnimatedPrimitives';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { ToolCard } from '../../design-system/components/ToolCard';
import {
  IconAsteroid,
  IconComet,
  IconFish,
  IconRadar,
  IconTarget,
  IconTrack,
  IconTrain,
  IconWallet,
  IconWork,
} from '../../design-system/icons';

/** The original 8 tools, plus the Bounty Decoder (web-only addition). */
const TOOLS = [
  {
    title: 'Asteroid Analyzer',
    subtitle: 'Decode 9-digit asteroid IDs',
    icon: <IconAsteroid size={28} />,
    tint: '#7AE3FF',
    path: '/tools/asteroid',
  },
  {
    title: 'Bounty Decoder',
    subtitle: "Decode a Mars bounty's 10-digit FOE ID",
    icon: <IconTarget size={28} />,
    tint: '#FF7A93',
    path: '/tools/foe',
  },
  {
    title: 'Fishing Map',
    subtitle: '96 zones + 4 map rooms, depths & poles',
    icon: <IconFish size={28} />,
    tint: '#5FE8A0',
    path: '/tools/fishing',
  },
  {
    title: 'Mars Express',
    subtitle: 'Live schedule + zone alerts',
    icon: <IconTrain size={28} />,
    tint: '#FFB347',
    path: '/tools/mars-express',
  },
  {
    title: 'Wallet Lookup',
    subtitle: 'Find a wallet from a name, or vice versa',
    icon: <IconWallet size={28} />,
    tint: '#4FC3FF',
    path: '/tools/wallet',
  },
  {
    title: 'System Scan',
    subtitle: 'Live planet positions (network · JPL NASA)',
    icon: <IconRadar size={28} />,
    tint: '#4FC3FF',
    path: '/tools/scan',
  },
  {
    title: 'Discoveries',
    subtitle: 'Find comets and asteroids by date (NASA SBDB)',
    icon: <IconComet size={28} />,
    tint: '#7AE3FF',
    path: '/tools/discoveries',
  },
  {
    title: 'Tracker',
    subtitle: 'Track a comet or asteroid live (JPL Horizons)',
    icon: <IconTrack size={28} />,
    tint: '#5FE8A0',
    path: '/tools/tracker',
  },
  {
    title: 'Jobs',
    subtitle: 'Search 371 jobs by faction, reward, skill, location',
    icon: <IconWork size={28} />,
    tint: '#FFB347',
    path: '/tools/jobs',
  },
];

/** Tools deck home (/tools). */
export function ToolsHomeView() {
  const navigate = useNavigate();
  return (
    <BannerPage bannerLabel="ESSI · Operations Bridge">
      <PageScrollView padding="12px 12px 32px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TOOLS.map((tool, i) => (
            <ConsoleReveal key={tool.path} delay={i * 60}>
              <ToolCard
                title={tool.title}
                subtitle={tool.subtitle}
                icon={tool.icon}
                tint={tool.tint}
                onTap={() => navigate(tool.path)}
              />
            </ConsoleReveal>
          ))}
        </div>
      </PageScrollView>
    </BannerPage>
  );
}
