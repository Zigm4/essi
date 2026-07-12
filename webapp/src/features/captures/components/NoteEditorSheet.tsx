import { useMemo, useRef, useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { Haptics } from '../../../core/haptics';
import { logError } from '../../../core/logging';
import { showSnackbar } from '../../../core/snackbar';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { SectionHeader } from '../../../design-system/components/SectionHeader';
import { IconTag } from '../../../design-system/icons';
import type { NoteModel } from '../models';
import { loadTags } from '../queries';
import { saveNote } from '../repository';
import { useLiveQuery } from '../useLiveQuery';
import { AutoGrowTextArea } from './AutoGrowTextArea';
import { SheetShell } from './SheetShell';
import { TagInputField, type TagInputHandle } from './TagInputField';
import fields from './EditorFields.module.css';

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** Note editor sheet (spec §8). Create when `initial` is null, else edit. */
export function NoteEditorSheet({
  initial,
  onClose,
}: {
  initial: NoteModel | null;
  onClose: () => void;
}) {
  const initialTitle = initial?.title ?? '';
  const initialBody = initial?.body ?? '';
  const initialTags = useMemo(() => initial?.tags.map((t) => t.displayName) ?? [], [initial]);

  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [tags, setTags] = useState<string[]>(initialTags);
  const tagInputRef = useRef<TagInputHandle>(null);

  const tagsResult = useLiveQuery(loadTags, []);
  const suggestionPool = (tagsResult.data ?? []).map((t) => t.displayName);

  const canSave = title.trim() !== '' || body.trim() !== '';
  const dirty =
    title !== initialTitle || body !== initialBody || !sameTags(tags, initialTags);

  const onSave = () => {
    // F38: commit any half-typed tag token before saving.
    const finalTags = tagInputRef.current?.commitPending() ?? tags;
    void (async () => {
      try {
        await saveNote({ id: initial?.id, title, body, tagDisplayNames: finalTags });
        Haptics.success();
        onClose();
      } catch (e) {
        logError(e);
        showSnackbar(friendlyError(e, "Couldn't save - please try again."), { danger: true });
      }
    })();
  };

  return (
    <SheetShell
      title={initial === null ? 'New note' : 'Edit note'}
      canSave={canSave}
      dirty={dirty}
      onClose={onClose}
      onSave={onSave}
    >
      <GlassCard>
        <input
          type="text"
          className={fields.titleInput}
          value={title}
          placeholder="Title"
          aria-label="Title"
          autoCapitalize="sentences"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={fields.divider} />
        <AutoGrowTextArea
          value={body}
          onChange={setBody}
          placeholder="Body"
          ariaLabel="Body"
          minRows={6}
          maxRows={30}
          className={fields.textArea}
        />
      </GlassCard>

      <SectionHeader title="Tags" icon={<IconTag size={18} />} className={fields.tagsHeader} />

      <TagInputField
        ref={tagInputRef}
        tags={tags}
        onChange={setTags}
        suggestionPool={suggestionPool}
      />
    </SheetShell>
  );
}
