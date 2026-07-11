import type { ReactNode } from 'react';

/**
 * Inline SVG icon set — Material Symbols outlined style on a 24px grid,
 * stroke-based (no icon font dependency). Tab icons accept `filled` for
 * their active variants (heavier stroke + translucent fill).
 */

export interface IconProps {
  size?: number;
  className?: string;
}

interface SvgProps extends IconProps {
  children: ReactNode;
  strokeWidth?: number;
}

function Svg({ size = 24, className, strokeWidth = 1.8, children }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type TabIconProps = IconProps & { filled?: boolean };

function tabFill(filled: boolean) {
  return filled
    ? { fill: 'currentColor', fillOpacity: 0.3, strokeWidth: 2.2 }
    : { fill: 'none', strokeWidth: 1.8 };
}

// --- Tab bar -----------------------------------------------------------------

/** handyman — crossed tools. */
export function IconTools({ filled = false, ...props }: TabIconProps) {
  const f = tabFill(filled);
  return (
    <Svg {...props} strokeWidth={f.strokeWidth}>
      <path d="M3.5 6 6 3.5l4 4-2.5 2.5z" fill={f.fill} fillOpacity={filled ? 0.3 : undefined} />
      <path d="M9 10.5 19.5 21" />
      <path d="M20.5 5.5l-3-3L14 6l3 3z" fill={f.fill} fillOpacity={filled ? 0.3 : undefined} />
      <path d="M15.5 7.5 4 19l1.5 1.5" />
    </Svg>
  );
}

/** note_alt — pad with pencil. */
export function IconNotes({ filled = false, ...props }: TabIconProps) {
  const f = tabFill(filled);
  return (
    <Svg {...props} strokeWidth={f.strokeWidth}>
      <rect x="4" y="4" width="16" height="17" rx="2" fill={f.fill} fillOpacity={filled ? 0.3 : undefined} />
      <path d="M9 2h6v4H9z" />
      <path d="M8.5 16.5v-1.6l4.3-4.3 1.6 1.6-4.3 4.3z" />
    </Svg>
  );
}

/** inventory_2 — storage box. */
export function IconHangar({ filled = false, ...props }: TabIconProps) {
  const f = tabFill(filled);
  return (
    <Svg {...props} strokeWidth={f.strokeWidth}>
      <rect x="3" y="3" width="18" height="5" rx="1" fill={f.fill} fillOpacity={filled ? 0.3 : undefined} />
      <path d="M4.5 8v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </Svg>
  );
}

/** menu_book — open book. */
export function IconKnowledge({ filled = false, ...props }: TabIconProps) {
  const f = tabFill(filled);
  return (
    <Svg {...props} strokeWidth={f.strokeWidth}>
      <path
        d="M2 5.5c2-1 4.4-1.4 6.4-.9 1.4.3 2.7 1 3.6 1.9.9-.9 2.2-1.6 3.6-1.9 2-.5 4.4-.1 6.4.9v13.7c-2-1-4.4-1.4-6.4-.9-1.4.3-2.7 1-3.6 1.9-.9-.9-2.2-1.6-3.6-1.9-2-.5-4.4-.1-6.4.9z"
        fill={f.fill}
        fillOpacity={filled ? 0.3 : undefined}
      />
      <path d="M12 6.5v13.7" />
    </Svg>
  );
}

/** more_horiz — three dots (same in both states). */
export function IconMoreHoriz(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// --- Navigation & actions ----------------------------------------------------

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </Svg>
  );
}

export function IconAdd(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconExpandMore(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconExpandLess(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 15 6-6 6 6" />
    </Svg>
  );
}

export function IconArrowUpward(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  );
}

export function IconArrowBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  );
}

export function IconArrowForward(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Svg>
  );
}

export function IconOpenInNew(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M21 3l-11 11" />
    </Svg>
  );
}

// --- Status & feedback ---------------------------------------------------------

export function IconContentCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-6" />
    </Svg>
  );
}

export function IconWarningAmber(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconInfoOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconHelpOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.2a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.3 1-1.3 1.9v.4" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconExploreOff(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.6 9.4-1.8 4.3-4.3 1.8 1.8-4.3z" />
      <path d="M3.5 3.5l17 17" />
    </Svg>
  );
}

// --- Menu & settings -----------------------------------------------------------

export function IconTune(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="14.5" cy="6.5" r="2" fill="var(--bg-deepest)" />
      <circle cx="8" cy="12" r="2" fill="var(--bg-deepest)" />
      <circle cx="16.5" cy="17.5" r="2" fill="var(--bg-deepest)" />
    </Svg>
  );
}

export function IconMailOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fillOpacity="0.3" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Svg>
  );
}

export function IconForum(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6l-4 4z" />
      <path d="M21 8h1v12l-4-3.5H8" />
    </Svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5.5 12.6 10l4.4 1.5-4.4 1.5L11 17.5 9.4 13 5 11.5 9.4 10z" />
      <path d="m18.5 2.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </Svg>
  );
}

export function IconGraphicEq(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </Svg>
  );
}

export function IconDataObject(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 4c-2 0-3 1-3 3v2c0 1.3-.9 2.4-2.2 2.8v.4C4.6 12.6 5.5 13.7 5.5 15v2c0 2 1 3 3 3" />
      <path d="M15.5 4c2 0 3 1 3 3v2c0 1.3.9 2.4 2.2 2.8v.4c-1.3.4-2.2 1.5-2.2 2.8v2c0 2-1 3-3 3" />
    </Svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 16V4M7 8.5 12 3.5l5 5" />
      <path d="M4.5 20h15" />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v12M7 11.5l5 5 5-5" />
      <path d="M4.5 20h15" />
    </Svg>
  );
}

export function IconReplay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1.5 4v6h6" />
      <path d="M4 15a9 9 0 1 0 1.6-9.4L1.5 10" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 7 3v5.5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
    </Svg>
  );
}

export function IconShieldMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 7 3v5.5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
      <path d="M13.6 8.2a4 4 0 1 0 2 6.7 4.8 4.8 0 0 1-2-6.7z" />
    </Svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </Svg>
  );
}

export function IconSatelliteAlt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 8 4-4 3 3-4 4z" />
      <path d="m13.5 18 4-4 3 3-4 4z" />
      <path d="m9 12 3-3 3 3-3 3z" />
      <path d="M8 16c0 2.2 1.8 4 4 4" strokeDasharray="1.5 2.5" />
    </Svg>
  );
}

export function IconGridView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  );
}

export function IconWifiTethering(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" />
      <path d="M8.5 9.8a5 5 0 0 1 7 0M6 7a9 9 0 0 1 12 0" />
      <path d="M8.7 16.3a5 5 0 0 1-1.7-2.3M15.3 16.3a5 5 0 0 0 1.7-2.3" />
    </Svg>
  );
}

export function IconRocketLaunch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.2 2.8c3.4.6 6.4 3.6 7 7l-8.4 8.4-7-7z" />
      <circle cx="14.7" cy="9.3" r="1.7" />
      <path d="M6.5 14.5 3 16l2-2M9.5 17.5 8 21l2-2" />
      <path d="M2.5 21.5c.3-1.6 1.1-3.1 2.3-3.9" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPublic(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z" />
    </Svg>
  );
}

// --- Tool icons ----------------------------------------------------------------

/** radar — System Scan. */
export function IconRadar(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 12l6-6.5" />
    </Svg>
  );
}

/** hexagon target — Asteroid Analyzer. */
export function IconAsteroid(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  );
}

/** fish — Fishing Map. */
export function IconFish(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12s3-5 9-5c3.7 0 6.4 2.8 7.5 5-1.1 2.2-3.8 5-7.5 5-6 0-9-5-9-5z" />
      <path d="M5 12 2.5 8.5v7z" />
      <circle cx="16.5" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** train front — Mars Express. */
export function IconTrain(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3" width="14" height="14" rx="2.5" />
      <path d="M5 11h14" />
      <circle cx="9" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8.5 17 6 21M15.5 17 18 21" />
    </Svg>
  );
}

/** wallet — Wallet Lookup. */
export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13.5" rx="2" />
      <path d="M14 10.5h7v4.5h-7a2.25 2.25 0 0 1 0-4.5z" />
      <circle cx="16.8" cy="12.75" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** comet — Discoveries. */
export function IconComet(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="16.5" cy="7.5" r="3.2" />
      <path d="M13.7 10.3 4 20M16.2 11.7l-6 8" />
    </Svg>
  );
}

/** my_location crosshair — Tracker. */
export function IconTrack(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  );
}

/** briefcase — Jobs. */
export function IconWork(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="7.5" width="18" height="13" rx="2" />
      <path d="M9 7.5V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12.5h18" />
    </Svg>
  );
}
