import { Haptics } from '../../../core/haptics';
import { showSnackbar } from '../../../core/snackbar';
import type { FavoriteKindValue } from '../../../data/db';
import { IconStarBorder, IconStarFilled } from './toolIcons';
import { toggleFavorite } from './favorites';
import styles from './FavoriteButton.module.css';

/**
 * Star toggle (spec §1.4 FavoriteButton). Inactive: star_border in textDim;
 * active: star in accentWarn. On failure shows "Couldn't update favorite.".
 */
export function FavoriteButton({
  kind,
  id,
  active,
  size = 18,
  tooltip = 'Favorite',
}: {
  kind: FavoriteKindValue;
  id: string;
  active: boolean;
  size?: number;
  tooltip?: string;
}) {
  const label = active ? 'Remove favorite' : tooltip;
  const onClick = async () => {
    Haptics.selection();
    try {
      await toggleFavorite(kind, id);
    } catch {
      showSnackbar("Couldn't update favorite.", { danger: true });
    }
  };
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={() => {
        void onClick();
      }}
    >
      {active ? <IconStarFilled size={size} /> : <IconStarBorder size={size} />}
    </button>
  );
}
