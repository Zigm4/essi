import { useMemo, useRef, useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { Haptics } from '../../../core/haptics';
import { logError } from '../../../core/logging';
import { showSnackbar } from '../../../core/snackbar';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { SectionHeader } from '../../../design-system/components/SectionHeader';
import { IconTag } from '../../../design-system/icons';
import type { LinkModel } from '../models';
import { loadTags } from '../queries';
import { saveLink } from '../repository';
import { useLiveQuery } from '../useLiveQuery';
import { AutoGrowTextArea } from './AutoGrowTextArea';
import { SheetShell } from './SheetShell';
import { TagInputField, type TagInputHandle } from './TagInputField';
import fields from './EditorFields.module.css';

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** Link editor sheet (spec §9). URL is the only required field. */
export function LinkEditorSheet({
  initial,
  onClose,
}: {
  initial: LinkModel | null;
  onClose: () => void;
}) {
  const initialTitle = initial?.title ?? '';
  const initialUrl = initial?.url ?? '';
  const initialNote = initial?.note ?? '';
  const initialTags = useMemo(() => initial?.tags.map((t) => t.displayName) ?? [], [initial]);

  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [note, setNote] = useState(initialNote);
  const [tags, setTags] = useState<string[]>(initialTags);
  const tagInputRef = useRef<TagInputHandle>(null);

  const tagsResult = useLiveQuery(loadTags, []);
  const suggestionPool = (tagsResult.data ?? []).map((t) => t.displayName);

  const canSave = url.trim() !== '';
  const dirty =
    title !== initialTitle ||
    url !== initialUrl ||
    note !== initialNote ||
    !sameTags(tags, initialTags);

  const onSave = () => {
    // F38: commit any half-typed tag token before saving.
    const finalTags = tagInputRef.current?.commitPending() ?? tags;
    void (async () => {
      try {
        await saveLink({ id: initial?.id, title, url, note, tagDisplayNames: finalTags });
        Haptics.success();
        onClose();
      } catch (e) {
        logError(e);
        showSnackbar(friendlyError(e, "Couldn't save — please try again."), { danger: true });
      }
    })();
  };

  return (
    <SheetShell
      title={initial === null ? 'New link' : 'Edit link'}
      canSave={canSave}
      dirty={dirty}
      onClose={onClose}
      onSave={onSave}
    >
      <GlassCard>
        <input
          type="text"
          className={fields.linkTitleInput}
          value={title}
          placeholder="Title (optional)"
          aria-label="Title"
          autoCapitalize="sentences"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={fields.divider} />
        <input
          type="url"
          className={fields.urlInput}
          value={url}
          placeholder="https://..."
          aria-label="URL"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className={fields.divider} />
        <AutoGrowTextArea
          value={note}
          onChange={setNote}
          placeholder="Note (optional)"
          ariaLabel="Note"
          minRows={3}
          maxRows={10}
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
