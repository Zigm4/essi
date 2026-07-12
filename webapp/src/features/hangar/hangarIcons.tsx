import type { ReactNode } from 'react';
import {
  IconHangar,
  IconMap,
  IconSearch,
  IconShield,
  IconTools,
  IconWifiTethering,
  type IconProps,
} from '../../design-system/icons';
import type { ShipRight } from './roles';

/**
 * Inline icons used by the Hangar that are not in the shared `icons.tsx` set
 * (kept local to the feature so the shared file stays untouched). Same
 * stroke-based, 24px-grid Material-Symbols style as the shared set.
 */

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

// --- General hangar icons ----------------------------------------------------

/** place - map pin. */
export function IconPlace(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21c4.5-4.2 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 2.5 6.8 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </Svg>
  );
}

/** verified - badge with a tick. */
export function IconVerified(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 2.5 2.3 1.7 2.9-.2 1 2.7 2.3 1.7-.9 2.7.9 2.7-2.3 1.7-1 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-1-2.7L3.5 15.6l.9-2.7-.9-2.7 2.3-1.7 1-2.7 2.9.2z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Svg>
  );
}

/** remove - minus. */
export function IconRemove(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

/** add - plus (local copy sized for steppers). */
export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** cancel - X in a circle. */
export function IconCancel(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  );
}

/** directions_car - LANDCRAFT header. */
export function IconDirectionsCar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 16.5v2a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-2M19 16.5v2a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-2" />
      <path d="M3 16.5v-3.2l1.7-4.3A2 2 0 0 1 6.6 7.7h10.8a2 2 0 0 1 1.9 1.3L21 13.3v3.2z" />
      <path d="M3 13.3h18" />
      <circle cx="7" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** sailing - WATERCRAFT header. */
export function IconSailing(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 14h7z" />
      <path d="M13.5 6.5 18 14h-4.5z" />
      <path d="M3 17.5c1.2 1.2 2.4 1.2 3.6 0s2.4-1.2 3.6 0 2.4 1.2 3.6 0 2.4-1.2 3.6 0" />
    </Svg>
  );
}

/** archive - empty-state icon. */
export function IconArchive(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5" />
      <path d="M9.5 12h5" />
    </Svg>
  );
}

/** groups - Crew roles header. */
export function IconGroups(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 18.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.3a3 3 0 0 1 0 5.4" />
      <path d="M17 13.4a5.5 5.5 0 0 1 3.5 5.1" />
    </Svg>
  );
}

/** notes - Note header. */
export function IconNotesLines(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </Svg>
  );
}

/** directions_boat_filled - Owner row + EVIL intro header. */
export function IconDirectionsBoat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14.5 5 9h14l1 5.5" fill="currentColor" fillOpacity="0.25" />
      <path d="M12 3v6" />
      <path d="M3 15.5c1.3 1.3 2.6 1.3 3.9 0s2.6-1.3 3.9 0 2.6 1.3 3.9 0 2.6-1.3 3.9 0" />
    </Svg>
  );
}

// --- Crew role icons ---------------------------------------------------------

/** flight - Pilot. */
function IconFlight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5c1 0 1.6 1.3 1.6 3v4.2l6.4 3.8v1.8l-6.4-2v3.7l1.9 1.4v1.3L12 22l-3.5-1v-1.3l1.9-1.4v-3.7l-6.4 2v-1.8l6.4-3.8V5.5c0-1.7.6-3 1.6-3z" />
    </Svg>
  );
}

/** center_focus_strong - Gunner. */
function IconCenterFocus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  );
}

/** build - Technician (wrench). */
function IconBuild(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.2L3 17.5 6.5 21l6.8-6.9a3.5 3.5 0 0 0 4.2-4.6l-2.3 2.3-2.1-2.1z" />
    </Svg>
  );
}

/** local_hospital - Medic (cross). */
function IconMedical(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

/** restaurant - Chef (fork + knife). */
function IconRestaurant(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3v6a2 2 0 0 0 4 0V3M9 3v18" />
      <path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4V3zM16 12v9" />
    </Svg>
  );
}

/** science - Alchemist (flask). */
function IconScience(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3h4M10.5 3v6L5.5 18a1.5 1.5 0 0 0 1.3 2.3h10.4A1.5 1.5 0 0 0 18.5 18l-5-9V3" />
      <path d="M8 14h8" />
    </Svg>
  );
}

const ROLE_ICON: Record<ShipRight, (props: IconProps) => ReactNode> = {
  pilot: IconFlight,
  gunner: IconCenterFocus,
  cartographer: IconMap,
  prospector: IconSearch,
  signaller: IconWifiTethering,
  technician: IconBuild,
  sentry: IconShield,
  fabricator: IconTools,
  medic: IconMedical,
  quartermaster: IconHangar,
  chef: IconRestaurant,
  alchemist: IconScience,
};

/** Renders the Material icon for a crew seat (spec §5.3 role-icon table). */
export function RoleIcon({ right, size = 12, className }: { right: ShipRight } & IconProps) {
  return ROLE_ICON[right]({ size, className });
}
