import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Haptics } from '../../../core/haptics';
import { deleteWithUndo } from '../../../core/undoDelete';
import { IconNotes } from '../../../design-system/icons';
import { useCapturesStore } from '../capturesStore';
import { filterNotes, listEmptyKind, liveTagSelection } from '../logic';
import { loadNotes, loadTags } from '../queries';
import { deleteNote, restoreNote } from '../repository';
import { useLiveQuery } from '../useLiveQuery';
import { CaptureListShell } from './CaptureListShell';
import { NoteCard } from './NoteCard';

/** Deletes at once; the snackbar offers Undo (spec §6). */
function removeNote(id: string): void {
  Haptics.selection();
  void deleteWithUndo('note', () => deleteNote(id), restoreNote);
}

/** Notes list embedded in the Captures home (spec §6). */
export function NotesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const notes = useLiveQuery(loadNotes, []);
  const tags = useLiveQuery(loadTags, []);
  const selectedTags = useCapturesStore((s) => s.notesSelectedTags);
  const toggleTag = useCapturesStore((s) => s.toggleNotesTag);
  const clearTags = useCapturesStore((s) => s.clearNotesTags);

  const all = notes.data ?? [];
  const activeTags = liveTagSelection(selectedTags, tags.data);
  const filtered = filterNotes(all, search, activeTags);

  return (
    <CaptureListShell
      loading={notes.data === undefined && notes.error === undefined}
      error={notes.error}
      errorFallback="Couldn't load your notes."
      searchPlaceholder="Search notes"
      search={search}
      onSearchChange={setSearch}
      allTags={tags.data ?? []}
      selectedTagIds={activeTags}
      onToggleTag={toggleTag}
      isEmpty={filtered.length === 0}
      emptyKind={listEmptyKind(all.length, search, activeTags.size > 0)}
      onClearFilters={() => {
        setSearch('');
        clearTags();
      }}
      emptyIcon={<IconNotes size={48} />}
      emptyTitleNone="No notes yet"
      emptyCaptionNone="Tap + to capture your first note."
    >
      {filtered.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onOpen={() => navigate(`/captures/note/${encodeURIComponent(note.id)}`)}
          onDelete={() => removeNote(note.id)}
        />
      ))}
    </CaptureListShell>
  );
}
