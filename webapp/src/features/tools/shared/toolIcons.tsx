import type { ReactNode } from 'react';

/**
 * Extra Material-Symbols-style inline icons used across the local tools
 * (jobs / fishing / mars-express / wallet / asteroid). The shared
 * design-system icon set only covers app-chrome glyphs, so the tool-specific
 * ones live here. Same 24px stroke grid as design-system/icons.tsx.
 */

export interface ToolIconProps {
  size?: number;
  className?: string;
}

interface SvgProps extends ToolIconProps {
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

/** sort - descending bars. */
export function IconSort(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h10M4 18h5" />
    </Svg>
  );
}

/** star (filled). */
export function IconStarFilled(props: ToolIconProps) {
  return (
    <Svg {...props} strokeWidth={1.4}>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
        fill="currentColor"
      />
    </Svg>
  );
}

/** star_border. */
export function IconStarBorder(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </Svg>
  );
}

/** radio_button_unchecked. */
export function IconRadioUnchecked(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
    </Svg>
  );
}

/** pending - circle with three dots. */
export function IconPending(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="7.8" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** gpp_bad - shield with an X. */
export function IconGppBad(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 7 3v5.5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
      <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
    </Svg>
  );
}

/** bolt - lightning. */
export function IconBolt(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2 4 13h6l-1 9 9-11h-6z" />
    </Svg>
  );
}

/** local_atm - coin with S. */
export function IconLocalAtm(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14 9.2a2.4 2.4 0 0 0-2-1c-1.3 0-2.2.7-2.2 1.7 0 2.4 4.6 1.3 4.6 3.9 0 1.1-1 1.9-2.4 1.9a2.6 2.6 0 0 1-2.2-1.1" />
      <path d="M12 6.5v1.4M12 15.9v1.6" />
    </Svg>
  );
}

/** place - map pin. */
export function IconPlace(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21c4-4.5 6-7.8 6-11a6 6 0 1 0-12 0c0 3.2 2 6.5 6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </Svg>
  );
}

/** local_shipping - truck. */
export function IconLocalShipping(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M2 6.5h11v9H2z" />
      <path d="M13 9.5h4l3 3v3h-7z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </Svg>
  );
}

/** shield_outlined. */
export function IconShieldOutlined(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 7 3v5.5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
    </Svg>
  );
}

/** ios_share - box with an up arrow. */
export function IconIosShare(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2" />
      <path d="M12 15V3.5M8.5 6.5 12 3l3.5 3.5" />
    </Svg>
  );
}

/** flag_outlined. */
export function IconFlag(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M5 21V4M5 4.5c3-1.6 6 1.4 9 0 1.6-.7 2.9-.8 5 0v9c-2.1.8-3.4.7-5 0-3-1.4-6 1.6-9 0" />
    </Svg>
  );
}

/** checklist. */
export function IconChecklist(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M11 7h9M11 12h9M11 17h9" />
      <path d="m3 6.5 1.4 1.4L7.5 5" />
      <path d="m3 16.5 1.4 1.4L7.5 15" />
    </Svg>
  );
}

/** schedule - clock. */
export function IconSchedule(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** tram - front-view rail car. */
export function IconTram(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="13" rx="2.5" />
      <path d="M5 10.5h14" />
      <circle cx="9" cy="13.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.4" r="1" fill="currentColor" stroke="none" />
      <path d="M8.5 16.5 6.5 20.5M15.5 16.5l2 4M9.5 3.5 11 1M14.5 3.5 13 1" />
    </Svg>
  );
}

/** swap_horiz. */
export function IconSwapHoriz(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5 3.5 9.5l3 3M3.5 9.5H15" />
      <path d="m17.5 17.5 3-3-3-3M20.5 14.5H9" />
    </Svg>
  );
}

/** notifications_active - bell with waves. */
export function IconNotificationsActive(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2.5h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3.5 5.5A6.5 6.5 0 0 1 6 3M20.5 5.5A6.5 6.5 0 0 0 18 3" />
    </Svg>
  );
}

/** notifications_outlined - bell. */
export function IconNotificationsOutlined(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2.5h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
}

/** notifications_off - bell with slash. */
export function IconNotificationsOff(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16V10a6 6 0 0 1 8.5-5.4M18 12v4l1.5 2.5H8" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="m3.5 3.5 17 17" />
    </Svg>
  );
}

/** repeat. */
export function IconRepeat(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9V8a3 3 0 0 1 3-3h11l-3-3M20 15v1a3 3 0 0 1-3 3H6l3 3" />
    </Svg>
  );
}

/** cancel - circle with an X. */
export function IconCancel(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  );
}

/** bar_chart. */
export function IconBarChart(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 20V11M12 20V4M18 20v-6" />
    </Svg>
  );
}

/** list. */
export function IconList(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <circle cx="4" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** person. */
export function IconPerson(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0z" />
    </Svg>
  );
}

/** attach_money - dollar sign. */
export function IconAttachMoney(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M16 7.5a3 3 0 0 0-2.8-1.7c-2 0-3.2 1-3.2 2.5 0 3.6 6.5 1.9 6.5 5.7 0 1.6-1.4 2.7-3.5 2.7A3.6 3.6 0 0 1 7 15" />
      <path d="M12 3.5v3M12 16.5v4" />
    </Svg>
  );
}

/** money_off - dollar sign with a slash. */
export function IconMoneyOff(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 7.2A3 3 0 0 0 13 5.8c-1.3 0-2.3.4-2.9 1.1M8 14.5a3.6 3.6 0 0 0 3.5 2.2c1 0 1.8-.3 2.4-.7" />
      <path d="M12 3.5v3M12 16.5v4" />
      <path d="m4 4 16 16" />
    </Svg>
  );
}

/** set_meal - fish on a plate. */
export function IconSetMeal(props: ToolIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 12s1.8-2.6 4.5-2.6c2 0 3.4 1.5 4 2.6-.6 1.1-2 2.6-4 2.6-2.7 0-4.5-2.6-4.5-2.6z" />
      <path d="m6.5 12-1.6-1.7v3.4z" />
    </Svg>
  );
}
