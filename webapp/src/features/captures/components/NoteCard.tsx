import { formatRelativeDate } from '../../../core/relativeDate';
import type { NoteModel } from '../models';
import { CaptureCardShell } from './CaptureCardShell';
import { ChipScroller } from './ChipScroller';
import styles from './Cards.module.css';

/** NoteCard list row (spec §12). Body preview is RAW markdown source. */
export function NoteCard({
  note,
  onOpen,
  onDelete,
}: {
  note: NoteModel;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <CaptureCardShell ariaLabel={note.title || 'Untitled note'} onOpen={onOpen} onDelete={onDelete}>
      {note.title !== '' && <div className={styles.title}>{note.title}</div>}
      {note.body !== '' && (
        <div className={`${styles.preview} ${styles.previewNote} ${note.title !== '' ? styles.gap8 : ''}`}>
          {note.body}
        </div>
      )}
      <div className={`${styles.bottomRow} ${styles.gap8}`}>
        <span className={styles.date}>{formatRelativeDate(note.updatedAt)}</span>
        <div className={styles.chipsRight}>
          <ChipScroller tags={note.tags} reverse />
        </div>
      </div>
    </CaptureCardShell>
  );
}
