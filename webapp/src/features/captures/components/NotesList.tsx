import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logError } from '../../../core/logging';
import { IconNotes } from '../../../design-system/icons';
import { useCapturesStore } from '../capturesStore';
import { filterNotes } from '../logic';
import type { NoteModel } from '../models';
import { loadNotes, loadTags } from '../queries';
import { deleteNote } from '../repository';
import { useLiveQuery } from '../useLiveQuery';
import { CaptureListShell } from './CaptureListShell';
import { ConfirmDialog } from './ConfirmDialog';
import { NoteCard } from './NoteCard';

/** Notes list embedded in the Captures home (spec §6). */
export function NotesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteModel | null>(null);

  const notes = useLiveQuery(loadNotes, []);
  const tags = useLiveQuery(loadTags, []);
  const selectedTags = useCapturesStore((s) => s.notesSelectedTags);
  const toggleTag = useCapturesStore((s) => s.toggleNotesTag);

  const all = notes.data ?? [];
  const filtered = filterNotes(all, search, selectedTags);

  return (
    <>
      <CaptureListShell
        loading={notes.data === undefined && notes.error === undefined}
        error={notes.error}
        errorFallback="Couldn't load your notes."
        searchPlaceholder="Search notes"
        search={search}
        onSearchChange={setSearch}
        allTags={tags.data ?? []}
        selectedTagIds={selectedTags}
        onToggleTag={toggleTag}
        isEmpty={filtered.length === 0}
        hasQuery={search !== ''}
        emptyIcon={<IconNotes size={48} />}
        emptyTitleNone="No notes yet"
        emptyCaptionNone="Tap + to capture your first note."
      >
        {filtered.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onOpen={() => navigate(`/captures/note/${encodeURIComponent(note.id)}`)}
            onDelete={() => setDeleteTarget(note)}
          />
        ))}
      </CaptureListShell>

      {deleteTarget !== null && (
        <ConfirmDialog
          title="Delete note?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.id;
            setDeleteTarget(null);
            void deleteNote(id).catch(logError);
          }}
        />
      )}
    </>
  );
}
