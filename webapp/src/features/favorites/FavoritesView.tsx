import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../../core/errorText';
import { Haptics } from '../../core/haptics';
import { logError } from '../../core/logging';
import { showSnackbar } from '../../core/snackbar';
import { db, type FavoriteKindValue, type FavoriteRow } from '../../data/db';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { SubPage } from '../../design-system/components/SubPage';
import { IconFish, IconKnowledge, IconMap, IconTrack, IconWork } from '../../design-system/icons';
import { Spinner } from '../knowledge/components/Spinner';
import { IconPlace, IconStarBorder, IconStarFilled } from '../tools/shared/toolIcons';
import { favoritesRepository } from './favoritesRepository';
import { groupFavorites, sourceOf, type FavoriteGroup, type FavoriteItem, type FavoriteSources } from './favoritesList';
import { useFavoriteSources } from './useFavoriteSources';
import { useLiveQuery, type LiveResult } from './useLiveQuery';
import styles from './FavoritesView.module.css';

function kindIcon(kind: FavoriteKindValue, size: number): ReactNode {
  switch (kind) {
    case 'job':
      return <IconWork size={size} />;
    case 'kb_article':
      return <IconKnowledge size={size} />;
    case 'map':
      return <IconMap size={size} />;
    case 'map_zone':
      return <IconPlace size={size} />;
    case 'fishing_zone':
      return <IconFish size={size} />;
    case 'tracked_object':
      return <IconTrack size={size} />;
  }
}

const SOURCE_FAILED: Record<keyof FavoriteSources, string> = {
  jobs: "Couldn't load the job list - showing IDs.",
  articles: "Couldn't load the knowledge base - showing IDs.",
  maps: "Couldn't read the installed maps - showing IDs.",
  fishing: "Couldn't load the fishing map - showing IDs.",
  tracked: "Couldn't load the tracker catalog - showing IDs.",
};

/** Stars or un-stars through the toggle (so un-starring leaves its tombstone); no-op when already so. */
async function setStarred(kind: FavoriteKindValue, id: string, starred: boolean): Promise<void> {
  if ((await favoritesRepository.isFavorite(kind, id)) !== starred) await favoritesRepository.toggle(kind, id);
}

/** Un-stars at once, with Undo (as the Tracker unpins). */
async function unstar(item: FavoriteItem): Promise<void> {
  Haptics.selection();
  try {
    await setStarred(item.kind, item.id, false);
    showSnackbar(`${item.title} removed from favorites.`, {
      action: {
        label: 'Undo',
        onClick: () => {
          void setStarred(item.kind, item.id, true).catch((error: unknown) => {
            logError(error);
            showSnackbar("Couldn't star it again.", { danger: true });
          });
        },
      },
    });
  } catch (error) {
    logError(error);
    showSnackbar("Couldn't update favorite.", { danger: true });
  }
}

function FavoriteRowCard({ item, onUnstar }: { item: FavoriteItem; onUnstar: (item: FavoriteItem) => void }) {
  const navigate = useNavigate();
  const { target } = item;
  const content = (
    <>
      <span className={styles.rowIcon}>{kindIcon(item.kind, 20)}</span>
      <span className={styles.rowText}>
        <span className={`t-headline ${styles.rowTitle}`}>{item.title}</span>
        {item.subtitle.length > 0 && (
          <span className={item.known ? styles.rowSubtitle : styles.rowGone}>{item.subtitle}</span>
        )}
      </span>
    </>
  );
  return (
    <div className={styles.row}>
      {target === null ? (
        <div className={styles.rowMain}>{content}</div>
      ) : (
        <button
          type="button"
          className={`${styles.rowMain} ${styles.rowOpen}`}
          aria-label={item.subtitle.length > 0 ? `${item.title}. ${item.subtitle}` : item.title}
          onClick={() => {
            Haptics.tap();
            navigate(target.location, target.state === undefined ? undefined : { state: target.state });
          }}
        >
          {content}
        </button>
      )}
      <button
        type="button"
        className={styles.unstar}
        title="Remove favorite"
        aria-label={`Remove ${item.title} from favorites`}
        onClick={() => onUnstar(item)}
      >
        <IconStarFilled size={20} />
      </button>
    </div>
  );
}

function GroupBlock({ group, onUnstar }: { group: FavoriteGroup; onUnstar: (item: FavoriteItem) => void }) {
  return (
    <section className={styles.group} aria-label={group.title}>
      <SectionHeader title={group.title} icon={kindIcon(group.kind, 18)} />
      {group.status === 'loading' ? (
        <Spinner />
      ) : (
        <>
          {group.status === 'failed' && (
            <p className={styles.sourceError} role="status">
              {SOURCE_FAILED[sourceOf(group.kind)]}
            </p>
          )}
          <div className={styles.rows}>
            {group.items.map((item) => (
              <FavoriteRowCard key={`${item.kind}:${item.id}`} item={item} onUnstar={onUnstar} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <IconStarBorder size={40} />
      </span>
      <div className={`t-headline ${styles.centered}`}>No favorites yet</div>
      <p className={styles.emptyCaption}>
        Star a job, map, zone or fishing zone, bookmark an article, or pin an object in the Tracker -
        it shows up here.
      </p>
    </div>
  );
}

/** The page body for a favorites read and its sources (no Dexie here - testable). */
export function FavoritesContent({
  rows,
  sources,
  onUnstar,
}: {
  rows: LiveResult<readonly FavoriteRow[]>;
  sources: FavoriteSources;
  onUnstar: (item: FavoriteItem) => void;
}) {
  if (rows.status === 'loading') return <Spinner padded />;
  if (rows.status === 'error') {
    return <p className={styles.errorText}>{friendlyError(rows.error, "Couldn't load your favorites.")}</p>;
  }
  const groups = groupFavorites(rows.data, sources);
  if (groups.length === 0) return <EmptyState />;
  return (
    <>
      {groups.map((group) => (
        <GroupBlock key={group.kind} group={group} onUnstar={onUnstar} />
      ))}
    </>
  );
}

/** /menu/favorites - everything starred, bookmarked or pinned, by kind (live). */
export function FavoritesView() {
  const rows = useLiveQuery<readonly FavoriteRow[]>(() => db.favorites.toArray(), []);
  const sources = useFavoriteSources(rows.status === 'ready' ? rows.data : null);
  return (
    <SubPage title="Favorites">
      <FavoritesContent rows={rows} sources={sources} onUnstar={(item) => void unstar(item)} />
    </SubPage>
  );
}
