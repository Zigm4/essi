import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { allowedExternalUrl, launchExternal } from '../../core/externalLink';
import { formatRelativeDate } from '../../core/relativeDate';
import { GlassCard } from '../../design-system/components/GlassCard';
import { IconForum } from '../../design-system/icons';
import { isDiscordUrl } from './logic';
import { ChipScroller } from './components/ChipScroller';
import { DetailFallback } from './components/DetailFallback';
import { DetailScaffold } from './components/DetailScaffold';
import { IconLink } from './components/icons';
import { MarkdownView } from './components/MarkdownView';
import { LinkEditorSheet } from './components/LinkEditorSheet';
import { loadLinks } from './queries';
import { useLiveQuery } from './useLiveQuery';
import styles from './components/CaptureDetail.module.css';

/** /captures/link/:id — a single saved link (spec §11). */
export function LinkDetailView() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const links = useLiveQuery(loadLinks, []);

  if (links.data === undefined && links.error === undefined) {
    return <DetailFallback loading label="Link not found." />;
  }

  const link = (links.data ?? []).find((l) => l.id === id);
  if (link === undefined) {
    return <DetailFallback loading={false} label="Link not found." />;
  }

  const hasTitle = link.title !== '';
  const hasNote = link.note !== '';
  const openable = allowedExternalUrl(link.url) !== null;
  const discord = isDiscordUrl(link.url);

  return (
    <>
      <DetailScaffold title="Link" onEdit={() => setEditing(true)}>
        <GlassCard>
          {hasTitle && (
            <div className={`${styles.detailTitle} ${styles.linkTitleGap}`}>{link.title}</div>
          )}
          <button
            type="button"
            className={styles.urlRow}
            onClick={() => launchExternal(link.url)}
          >
            <span
              className={`${styles.urlIcon} ${openable ? styles.urlIconOpenable : styles.urlIconPlain}`}
            >
              {discord ? <IconForum size={18} /> : <IconLink size={18} />}
            </span>
            <span
              className={`${styles.urlText} ${openable ? styles.urlTextOpenable : styles.urlTextPlain}`}
            >
              {link.url}
            </span>
          </button>
          {hasNote && (
            <>
              <div className={styles.divider} />
              <MarkdownView source={link.note} />
            </>
          )}
        </GlassCard>
        <div className={styles.metaRow}>
          <span className={styles.metaDate}>{formatRelativeDate(link.updatedAt)}</span>
          <div className={styles.metaChips}>
            <ChipScroller tags={link.tags} reverse />
          </div>
        </div>
      </DetailScaffold>

      {editing && <LinkEditorSheet initial={link} onClose={() => setEditing(false)} />}
    </>
  );
}
