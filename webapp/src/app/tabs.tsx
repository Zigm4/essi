import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Haptics } from '../core/haptics';
import {
  IconHangar,
  IconKnowledge,
  IconMoreHoriz,
  IconNotes,
  IconTools,
} from '../design-system/icons';

/**
 * Shared tab model for the responsive shell - the mobile bottom capsule and
 * the desktop sidebar drive the same router navigation and per-tab history.
 */

export const TAB_ROOTS = ['/tools', '/captures', '/hangar', '/knowledge', '/menu'] as const;

export const TAB_LABELS = ['Tools', 'Notes', 'Hangar', 'Knowledge', 'Menu'] as const;

export function tabIcon(index: number, active: boolean, size: number): ReactNode {
  switch (index) {
    case 0:
      return <IconTools size={size} filled={active} />;
    case 1:
      return <IconNotes size={size} filled={active} />;
    case 2:
      return <IconHangar size={size} filled={active} />;
    case 3:
      return <IconKnowledge size={size} filled={active} />;
    default:
      return <IconMoreHoriz size={size} />;
  }
}

export function activeTabIndex(pathname: string): number {
  return TAB_ROOTS.findIndex((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** Last visited path per tab so switching tabs restores the sub-route. */
const lastTabPaths = new Map<number, string>();

export function useTabNavigation(): { current: number; onTab: (index: number) => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const current = activeTabIndex(location.pathname);

  useEffect(() => {
    if (current >= 0) lastTabPaths.set(current, location.pathname);
  }, [current, location.pathname]);

  const onTab = (index: number) => {
    Haptics.tap();
    const root = TAB_ROOTS[index] ?? '/tools';
    if (index === current) {
      // Re-tapping the current tab resets the branch to its root.
      lastTabPaths.set(index, root);
      navigate(root);
      return;
    }
    navigate(lastTabPaths.get(index) ?? root);
  };

  return { current, onTab };
}
