import type { ReactNode } from 'react';
import type { IconProps } from '../../../design-system/icons';

/**
 * Local icon(s) needed by Captures that the shared design-system set does not
 * provide. Same stroke-based Material Symbols style / 24px grid as
 * design-system/icons.tsx (which is read-only).
 */

function Svg({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** link - chain (Material `link`). Used for non-Discord link rows. */
export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 12h6" />
      <path d="M10.5 8.5H8a3.5 3.5 0 0 0 0 7h2.5" />
      <path d="M13.5 8.5H16a3.5 3.5 0 0 1 0 7h-2.5" />
    </Svg>
  );
}

/** backup - cloud with up arrow (Material `backup_outlined`). Backup banner. */
export function IconBackup(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 18h9a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 9.6 3.7 3.7 0 0 0 7.5 18z" />
      <path d="M12 20.5v-7.5" />
      <path d="M9.5 15l2.5-2.5 2.5 2.5" />
    </Svg>
  );
}
