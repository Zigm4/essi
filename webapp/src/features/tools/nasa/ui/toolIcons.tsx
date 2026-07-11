import type { ReactNode } from 'react';

/**
 * Extra Material-Symbols-style icons needed by the NASA tools that are not in
 * the shared design-system set (which is read-only). Same 24px stroke grid.
 */

interface IconProps {
  size?: number;
  className?: string;
}

function TSvg({
  size = 24,
  className,
  strokeWidth = 1.8,
  children,
}: IconProps & { strokeWidth?: number; children: ReactNode }) {
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

/** history — clock face with a counter-clockwise arrow. */
export function IconHistory(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M3.5 8A9 9 0 1 1 3 12" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </TSvg>
  );
}

/** ios_share — box with an upward arrow out the top. */
export function IconShare(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M12 3v11" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M6 11H4.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H18" />
    </TSvg>
  );
}

/** stop_circle — circle with a filled square. */
export function IconStopCircle(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" stroke="none" />
    </TSvg>
  );
}

/** push_pin (filled). */
export function IconPushPin(props: IconProps) {
  return (
    <TSvg {...props}>
      <path
        d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z"
        fill="currentColor"
        fillOpacity={0.25}
      />
      <path d="M12 15v6" />
    </TSvg>
  );
}

/** push_pin_outlined. */
export function IconPushPinOutlined(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z" />
      <path d="M12 15v6" />
    </TSvg>
  );
}

/** center_focus_strong — corner brackets around a dot. */
export function IconCenterFocus(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </TSvg>
  );
}

/** list. */
export function IconList(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </TSvg>
  );
}

/** event_note — calendar with lines. */
export function IconEventNote(props: IconProps) {
  return (
    <TSvg {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4M8 13h8M8 17h5" />
    </TSvg>
  );
}

/** timer_outlined. */
export function IconTimer(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 3h6" />
    </TSvg>
  );
}

/** schedule — clock. */
export function IconSchedule(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </TSvg>
  );
}

/** link. */
export function IconLink(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M9 15l6-6" />
      <path d="M10.5 6.5 12 5a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
      <path d="M13.5 17.5 12 19a4 4 0 0 1-5.7-5.7l1.5-1.5" />
    </TSvg>
  );
}

/** functions — sigma. */
export function IconFunctions(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M17 5H7l6 7-6 7h10" />
    </TSvg>
  );
}

/** list_alt — bordered list. */
export function IconListAlt(props: IconProps) {
  return (
    <TSvg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </TSvg>
  );
}

/** description — document. */
export function IconDescription(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M7 3h7l4 4v14a0 0 0 0 1 0 0H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h3" />
    </TSvg>
  );
}

/** terminal. */
export function IconTerminal(props: IconProps) {
  return (
    <TSvg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </TSvg>
  );
}

/** code. */
export function IconCode(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
    </TSvg>
  );
}

/** star. */
export function IconStar(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />
    </TSvg>
  );
}

/** speed — gauge. */
export function IconSpeed(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-4" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </TSvg>
  );
}

/** alt_route — forking path. */
export function IconAltRoute(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M7 21V9" />
      <path d="M7 9a5 5 0 0 1 5 5v7" />
      <path d="M4.5 6.5 7 4l2.5 2.5" />
      <path d="M17 21v-6" />
      <path d="M14.5 6.5 17 4l2.5 2.5M17 4v5" />
    </TSvg>
  );
}

/** bubble_chart. */
export function IconBubbleChart(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="9" cy="9" r="4" />
      <circle cx="17" cy="8" r="2.4" />
      <circle cx="15.5" cy="16" r="3" />
    </TSvg>
  );
}

/** event_busy — calendar with an X. */
export function IconEventBusy(props: IconProps) {
  return (
    <TSvg {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
      <path d="M10 13l4 4M14 13l-4 4" />
    </TSvg>
  );
}

/** error — filled circle with exclamation. */
export function IconError(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </TSvg>
  );
}

/** radio_button_unchecked. */
export function IconRadioUnchecked(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="12" cy="12" r="8" />
    </TSvg>
  );
}

/** refresh. */
export function IconRefresh(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M20 11a8 8 0 1 0-.5 4" />
      <path d="M20 4v5h-5" />
    </TSvg>
  );
}

/** travel_explore — globe with a magnifier. */
export function IconTravelExplore(props: IconProps) {
  return (
    <TSvg {...props}>
      <circle cx="11" cy="11" r="7.2" />
      <path d="M3.8 11h14.4M11 3.8c2 2 3 4.6 3 7.2M11 3.8c-2 2-3 4.6-3 7.2" />
      <path d="M16.5 16.5 21 21" />
    </TSvg>
  );
}

/** delete_outline — trash can. */
export function IconDelete(props: IconProps) {
  return (
    <TSvg {...props}>
      <path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l1 12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </TSvg>
  );
}
