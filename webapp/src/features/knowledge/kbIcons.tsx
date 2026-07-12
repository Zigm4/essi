import type { ReactNode } from 'react';

/**
 * Material-symbol icons used by the knowledge / favorites / search area that
 * are not in `src/design-system/icons.tsx` (which is read-only). Same stroke
 * style: 24px grid, `currentColor`, rounded joins.
 */

export interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 24,
  className,
  strokeWidth = 1.8,
  fill = 'none',
  children,
}: IconProps & { strokeWidth?: number; fill?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
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

/** settings - gearshape. */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </Svg>
  );
}

/** groups - person.3. */
export function IconGroups(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="9" r="2.6" />
      <path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1" />
      <path d="M16 7.2a2.6 2.6 0 0 1 0 5" />
      <path d="M17 14.2a4 4 0 0 1 3.5 4v.8" />
    </Svg>
  );
}

/** star - category icon for the `star.fill` manifest name. */
export function IconStar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.14 1 5.86L12 17.9l-5.25 2.7 1-5.86L3.5 9.7l5.9-.9z" />
    </Svg>
  );
}

/** bookmark - default category / fallback icon. */
export function IconBookmark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4-7 4v-16a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** bookmark_border_rounded - inactive bookmark toggle. */
export function IconBookmarkBorder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-3.7L5.5 20V5a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** bookmark_rounded - active bookmark toggle. */
export function IconBookmarkFilled(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor">
      <path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-3.7L5.5 20V5a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** edit_note - drafts banner. */
export function IconEditNote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h11M4 12h6" />
      <path d="M4 17h5" />
      <path d="M14.5 18.5 20 13l-2-2-5.5 5.5-.5 2.5z" />
    </Svg>
  );
}

/** volunteer_activism - heart in an open hand. */
export function IconVolunteerActivism(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.5 8.2c-1-1.6-3.4-1.4-4 .4-.4 1.2.3 2.2 1 2.9l3 2.8 3-2.8c.7-.7 1.4-1.7 1-2.9-.6-1.8-3-2-4-.4z" />
      <path d="M3 15.5l3-1.2 4.2 2c.9.4 1.9.4 2.8 0L20 13.5c1-.4 2 .9 1.2 1.7l-5 4.2c-.8.7-1.9 1-3 .8L3 18.5z" />
    </Svg>
  );
}

/** broken_image_outlined - broken image tile. */
export function IconBrokenImage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 13l3-2.5 3 2.5" />
      <path d="M14.5 15.5l2.5-2 3 2.2" />
      <path d="M12 4.5v6M12 14v5.5" strokeDasharray="1.5 2" />
    </Svg>
  );
}

/** travel_explore - globe with a magnifier. */
export function IconTravelExplore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M3.6 8.5h13.8M3.6 12.5h9.4" />
      <path d="M10.5 3.6c2 2 3 4.4 3 6.9s-1 4.9-3 6.9c-2-2-3-4.4-3-6.9" />
      <path d="M16 16l4.5 4.5" />
    </Svg>
  );
}

/** search_off - magnifier with a slash. */
export function IconSearchOff(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M4 4l13 13" />
    </Svg>
  );
}

/** person_outline - wallet owner hit. */
export function IconPersonOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
    </Svg>
  );
}

/** sticky_note_2_outlined - note hit. */
export function IconStickyNote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 4.5h15v10l-5 5h-10z" />
      <path d="M19.5 14.5h-5v5" />
      <path d="M7.5 9h9M7.5 12.5h4" />
    </Svg>
  );
}

/** link - link hit. */
export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8 12l-1.8 1.8a3.1 3.1 0 0 0 4.4 4.4L12.4 16" />
      <path d="M16 12l1.8-1.8a3.1 3.1 0 0 0-4.4-4.4L11.6 8" />
    </Svg>
  );
}

/** push_pin_outlined - map-pin note hit. */
export function IconPushPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3.5h6l-1 5 2.5 3.5H7.5L10 8.5z" />
      <path d="M12 12v6.5" />
    </Svg>
  );
}
