import type { ReactNode } from 'react';
import { Haptics } from '../../core/haptics';
import { friendlyError } from '../../core/errorText';
import { logError } from '../../core/logging';
import { showSnackbar } from '../../core/snackbar';
import type { FavoriteKindValue } from '../../data/db';
import { favoritesRepository } from './favoritesRepository';
import { useLiveQuery } from './useLiveQuery';
import styles from './FavoriteButton.module.css';

/** Icon components accept an optional `size` (matches the design-system icons). */
export type FavoriteIcon = (props: { size?: number }) => ReactNode;

/** Default inactive star (star_border_rounded). */
function IconStarBorder({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.14 1 5.86L12 17.9l-5.25 2.7 1-5.86L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

/** Default active star (star_rounded). */
function IconStarFilled({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.14 1 5.86L12 17.9l-5.25 2.7 1-5.86L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

/**
 * Generic icon-button toggle (knowledge spec §10.4). Reads the live id set for
 * `kind`; until the stream emits it is treated as empty (shows inactive).
 * KB usage passes bookmark icons + `accentPrimary` active color.
 */
export function FavoriteButton({
  kind,
  id,
  icon: Icon = IconStarBorder,
  activeIcon: ActiveIcon = IconStarFilled,
  size = 22,
  tooltip = 'Favorite',
  activeColor = 'var(--accent-warn)',
}: {
  kind: FavoriteKindValue;
  id: string;
  icon?: FavoriteIcon;
  activeIcon?: FavoriteIcon;
  size?: number;
  tooltip?: string;
  activeColor?: string;
}) {
  const ids = useLiveQuery(() => favoritesRepository.getIds(kind), [kind]);
  const active = ids.status === 'ready' && ids.data.has(id);
  const label = active ? 'Remove favorite' : tooltip;

  const onClick = (): void => {
    Haptics.selection();
    favoritesRepository.toggle(kind, id).catch((error: unknown) => {
      logError(error);
      showSnackbar(friendlyError(error, "Couldn't update favorite."), { danger: true });
    });
  };

  return (
    <button
      type="button"
      className={styles.button}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{ color: active ? activeColor : 'var(--text-dim)' }}
    >
      {active ? <ActiveIcon size={size} /> : <Icon size={size} />}
    </button>
  );
}
