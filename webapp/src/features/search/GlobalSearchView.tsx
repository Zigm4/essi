import { useEffect, useState, type ReactNode } from 'react';
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
import { useLiveQuery } from '../favorites/useLiveQuery';
import {
  runGlobalSearch,
  totalHitCount,
  type GlobalSearchHit,
  type SearchGroup,
  type SearchHitIcon,
} from './globalSearch';
import styles from './GlobalSearchView.module.css';

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
    switch (hit.target.kind) {
      case 'route':
        navigate(hit.target.location);
        break;
      case 'wallet':
        navigate(`/tools/wallet?q=${encodeURIComponent(hit.target.query)}`);
        break;
      case 'job':
        // Job detail is a modal owned by the tools area (no route); deferred.
        navigate('/tools/jobs');
        break;
    }
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

function GroupBlock({ group }: { group: SearchGroup }) {
  return (
    <div className={styles.group}>
      <SectionHeader title={group.title} subtitle={resultCountLabel(group.total)} />
      <div className={styles.rows}>
        {group.visible.map((hit, index) => (
          <ResultRow key={`${hit.source}-${index}`} hit={hit} />
        ))}
      </div>
      {group.hasMore && (
        <p className={styles.more}>
          +{group.hiddenCount} more - refine your search to narrow down.
        </p>
      )}
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

/** /menu/search - global search across maps, KB, jobs, wallets, notes. */
export function GlobalSearchView() {
  const [text, setText] = useState('');
  const [committed, setCommitted] = useState('');

  // Debounce 250ms: committed query = trimmed field text, pending timer
  // cancelled on each keystroke and on unmount (§11.2.1).
  useEffect(() => {
    const trimmed = text.trim();
    const timer = setTimeout(() => setCommitted(trimmed), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useLiveQuery(() => runGlobalSearch(committed), [committed]);

  let body: ReactNode;
  if (committed.length === 0) {
    body = <Hint />;
  } else if (results.status === 'loading') {
    body = <Spinner padded />;
  } else if (results.status === 'error') {
    body = <p className={styles.errorText}>{friendlyError(results.error, "Couldn't run that search.")}</p>;
  } else if (totalHitCount(results.data) === 0) {
    body = <NoMatches query={committed} />;
  } else {
    body = (
      <div className={styles.groups}>
        {results.data.map((group) => (
          <GroupBlock key={group.source} group={group} />
        ))}
      </div>
    );
  }

  return (
    <DetailScaffold title="Search" bodyPadding="64px 12px 32px">
      <div className={styles.field}>
        <SearchField
          value={text}
          onChange={setText}
          placeholder="Search maps, jobs, wallets, notes…"
          autoFocus
          onClear={() => setCommitted('')}
        />
      </div>
      {body}
    </DetailScaffold>
  );
}
