import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { IconChevronRight, IconKnowledge, IconMap, IconWallet, IconWork } from '../../design-system/icons';
import { friendlyError } from '../../core/errorText';
import {
  IconLink,
  IconPersonOutline,
  IconPushPin,
  IconSearchOff,
  IconStickyNote,
  IconTravelExplore,
} from '../knowledge/kbIcons';
import { DetailScaffold } from '../knowledge/components/DetailScaffold';
import { SearchField } from '../knowledge/components/SearchField';
import { Spinner } from '../knowledge/components/Spinner';
import { ensureSeedImported } from '../knowledge/maps/data/seedImporter';
import { useLiveQuery } from '../favorites/useLiveQuery';
import {
  SEARCH_SOURCE_ORDER,
  SEARCH_SOURCE_TITLES,
  seeAllLink,
  targetLocation,
  totalHitCount,
  type GlobalSearchHit,
  type GlobalSearchResult,
  type SearchGroup,
  type SearchHitIcon,
  type SourceFailure,
} from './globalSearch';
import { runGlobalSearch } from './searchSources';
import { useSearchQuery } from './useSearchQuery';
import styles from './GlobalSearchView.module.css';

/**
 * The last results shown. Coming back from an opened result draws them at
 * once (before the live query re-emits), so the page's saved scroll offset
 * can be restored on a full-height list.
 */
let lastResult: GlobalSearchResult | null = null;

function sourceIcon(icon: SearchHitIcon): ReactNode {
  switch (icon) {
    case 'map':
      return <IconMap size={20} />;
    case 'menu_book':
      return <IconKnowledge size={20} />;
    case 'work':
      return <IconWork size={20} />;
    case 'person':
      return <IconPersonOutline size={20} />;
    case 'wallet':
      return <IconWallet size={20} />;
    case 'note':
      return <IconStickyNote size={20} />;
    case 'link':
      return <IconLink size={20} />;
    case 'pin':
      return <IconPushPin size={20} />;
  }
}

function resultCountLabel(n: number): string {
  return `${n} result${n === 1 ? '' : 's'}`;
}

function ResultRow({ hit }: { hit: GlobalSearchHit }) {
  const navigate = useNavigate();
  const ariaLabel = hit.subtitle.length > 0 ? `${hit.title}. ${hit.subtitle}` : hit.title;

  const open = (): void => {
    navigate(targetLocation(hit.target));
  };

  return (
    <GlassCard className={styles.row} onTap={open} ariaLabel={ariaLabel}>
      <div className={styles.rowInner}>
        <span className={styles.rowIcon}>{sourceIcon(hit.icon)}</span>
        <div className={styles.rowText}>
          <div className={`t-headline ${styles.rowTitle}`}>{hit.title}</div>
          {hit.subtitle.length > 0 && <div className={styles.rowSubtitle}>{hit.subtitle}</div>}
        </div>
        <span className={styles.rowChevron}>
          <IconChevronRight size={20} />
        </span>
      </div>
    </GlassCard>
  );
}

function GroupBlock({ group, query }: { group: SearchGroup; query: string }) {
  const navigate = useNavigate();
  const seeAll = seeAllLink(group.source, query);
  return (
    <div className={styles.group}>
      <SectionHeader title={group.title} subtitle={resultCountLabel(group.total)} />
      <div className={styles.rows}>
        {group.visible.map((hit, index) => (
          <ResultRow key={`${hit.source}-${index}`} hit={hit} />
        ))}
      </div>
      {group.hasMore &&
        (seeAll === null ? (
          <p className={styles.more}>
            +{group.hiddenCount} more - refine your search to narrow down.
          </p>
        ) : (
          <p className={styles.more}>
            +{group.hiddenCount} more -{' '}
            <button type="button" className={styles.moreLink} onClick={() => navigate(seeAll.location)}>
              {`show all in ${seeAll.label}`}
            </button>
          </p>
        ))}
    </div>
  );
}

function Hint() {
  return (
    <div className={styles.hint}>
      <span className={styles.hintIcon}>
        <IconTravelExplore size={40} />
      </span>
      <div className={`t-headline ${styles.centered}`}>Search everything</div>
      <p className={styles.hintCaption}>
        Find map zones, knowledge base articles, jobs, wallets, and your own notes - all in one
        place.
      </p>
    </div>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className={styles.noMatches}>
      <span className={styles.noMatchesIcon}>
        <IconSearchOff size={36} />
      </span>
      <div className={`t-headline ${styles.centered}`}>No matches</div>
      <p className={styles.noMatchesCaption}>
        {`Nothing matched “${query}”. Try a different term.`}
      </p>
    </div>
  );
}

/** "Jobs", "Jobs and Wallets", "Jobs, Wallets and Notes & links". */
function sourceList(failed: readonly SourceFailure[]): string {
  const names = failed.map((f) => SEARCH_SOURCE_TITLES[f.source]);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function Results({ result }: { result: GlobalSearchResult }) {
  const { query, groups, failed } = result;
  if (failed.length === SEARCH_SOURCE_ORDER.length) {
    return <p className={styles.errorText}>{friendlyError(failed[0]!.error, "Couldn't run that search.")}</p>;
  }
  return (
    <>
      {failed.length > 0 && (
        <p className={styles.sourceErrors} role="status">
          {`Couldn't search ${sourceList(failed)} - showing the other results.`}
        </p>
      )}
      {totalHitCount(groups) === 0 ? (
        <NoMatches query={query} />
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <GroupBlock key={group.source} group={group} query={query} />
          ))}
        </div>
      )}
    </>
  );
}

/** /menu/search - global search across maps, KB, jobs, wallets, notes. */
export function GlobalSearchView() {
  const { initial, text, setText, committed, clear } = useSearchQuery();

  // Map zones come from the installed maps: install the bundled seed if the
  // Knowledge tab was never opened (idempotent; never throws).
  useEffect(() => {
    void ensureSeedImported();
  }, []);

  const live = useLiveQuery(() => runGlobalSearch(committed), [committed]);
  // Right after a new query the hook still holds the previous one's data.
  const fresh = live.status === 'ready' && live.data.query === committed ? live.data : null;
  useEffect(() => {
    if (fresh !== null) lastResult = fresh;
  }, [fresh]);
  const result = fresh ?? (lastResult !== null && lastResult.query === committed ? lastResult : null);

  let body: ReactNode;
  if (committed.length === 0) {
    body = <Hint />;
  } else if (result !== null) {
    body = <Results result={result} />;
  } else if (live.status === 'error') {
    body = <p className={styles.errorText}>{friendlyError(live.error, "Couldn't run that search.")}</p>;
  } else {
    body = <Spinner padded />;
  }

  return (
    <DetailScaffold title="Search" bodyPadding="64px 12px 32px">
      <div className={styles.field}>
        <SearchField
          value={text}
          onChange={setText}
          placeholder="Search maps, jobs, wallets, notes…"
          autoFocus={initial.length === 0}
          onClear={clear}
        />
      </div>
      {body}
    </DetailScaffold>
  );
}
