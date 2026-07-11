import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logError } from '../../../core/logging';
import { useCapturesStore } from '../capturesStore';
import { filterLinks } from '../logic';
import type { LinkModel } from '../models';
import { loadLinks, loadTags } from '../queries';
import { deleteLink } from '../repository';
import { useLiveQuery } from '../useLiveQuery';
import { CaptureListShell } from './CaptureListShell';
import { ConfirmDialog } from './ConfirmDialog';
import { LinkCard } from './LinkCard';
import { IconLink } from './icons';

/** Links list embedded in the Captures home (spec §7). */
export function LinksList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LinkModel | null>(null);

  const links = useLiveQuery(loadLinks, []);
  const tags = useLiveQuery(loadTags, []);
  const selectedTags = useCapturesStore((s) => s.linksSelectedTags);
  const toggleTag = useCapturesStore((s) => s.toggleLinksTag);

  const all = links.data ?? [];
  const filtered = filterLinks(all, search, selectedTags);

  return (
    <>
      <CaptureListShell
        loading={links.data === undefined && links.error === undefined}
        error={links.error}
        errorFallback="Couldn't load your links."
        searchPlaceholder="Search links"
        search={search}
        onSearchChange={setSearch}
        allTags={tags.data ?? []}
        selectedTagIds={selectedTags}
        onToggleTag={toggleTag}
        isEmpty={filtered.length === 0}
        hasQuery={search !== ''}
        emptyIcon={<IconLink size={48} />}
        emptyTitleNone="No links yet"
        emptyCaptionNone="Save Discord messages and other URLs here."
      >
        {filtered.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            onOpen={() => navigate(`/captures/link/${encodeURIComponent(link.id)}`)}
            onDelete={() => setDeleteTarget(link)}
          />
        ))}
      </CaptureListShell>

      {deleteTarget !== null && (
        <ConfirmDialog
          title="Delete link?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.id;
            setDeleteTarget(null);
            void deleteLink(id).catch(logError);
          }}
        />
      )}
    </>
  );
}
