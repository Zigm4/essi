import { IconForum } from '../../../design-system/icons';
import { isDiscordUrl } from '../logic';
import type { LinkModel } from '../models';
import { CaptureCardShell } from './CaptureCardShell';
import { ChipScroller } from './ChipScroller';
import { IconLink } from './icons';
import styles from './Cards.module.css';

/** LinkCard list row (spec §13). No date; chips are left-aligned. */
export function LinkCard({
  link,
  onOpen,
  onDelete,
}: {
  link: LinkModel;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const discord = isDiscordUrl(link.url);
  const displayTitle = link.title !== '' ? link.title : link.url;
  return (
    <CaptureCardShell ariaLabel={displayTitle || 'Link'} onOpen={onOpen} onDelete={onDelete}>
      <div className={styles.linkHeader}>
        <span className={styles.linkIcon}>
          {discord ? <IconForum size={18} /> : <IconLink size={18} />}
        </span>
        <div className={styles.linkHeaderText}>
          <div className={styles.title}>{displayTitle}</div>
          <div className={styles.linkUrl}>{link.url}</div>
        </div>
      </div>
      {link.note !== '' && (
        <div className={`${styles.preview} ${styles.previewLink} ${styles.gap8}`}>{link.note}</div>
      )}
      {link.tags.length > 0 && (
        <div className={styles.gap8}>
          <ChipScroller tags={link.tags} />
        </div>
      )}
    </CaptureCardShell>
  );
}
