import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatRelativeDate } from '../../core/relativeDate';
import { GlassCard } from '../../design-system/components/GlassCard';
import { ChipScroller } from './components/ChipScroller';
import { DetailFallback } from './components/DetailFallback';
import { DetailScaffold } from './components/DetailScaffold';
import { MarkdownView } from './components/MarkdownView';
import { NoteEditorSheet } from './components/NoteEditorSheet';
import { loadNotes } from './queries';
import { useLiveQuery } from './useLiveQuery';
import styles from './components/CaptureDetail.module.css';

/** /captures/note/:id - a single note (spec §10). */
export function NoteDetailView() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const notes = useLiveQuery(loadNotes, []);

  if (notes.data === undefined && notes.error === undefined) {
    return <DetailFallback loading label="Note not found." />;
  }

  const note = (notes.data ?? []).find((n) => n.id === id);
  if (note === undefined) {
    return <DetailFallback loading={false} label="Note not found." />;
  }

  const hasTitle = note.title !== '';
  const hasBody = note.body !== '';

  return (
    <>
      <DetailScaffold title="Note" onEdit={() => setEditing(true)}>
        <GlassCard>
          {hasTitle && <div className={styles.detailTitle}>{note.title}</div>}
          {hasBody && (
            <>
              {hasTitle && <div className={styles.divider} />}
              <MarkdownView source={note.body} />
            </>
          )}
        </GlassCard>
        <div className={styles.metaRow}>
          <span className={styles.metaDate}>{formatRelativeDate(note.updatedAt)}</span>
          <div className={styles.metaChips}>
            <ChipScroller tags={note.tags} reverse />
          </div>
        </div>
      </DetailScaffold>

      {editing && <NoteEditorSheet initial={note} onClose={() => setEditing(false)} />}
    </>
  );
}
