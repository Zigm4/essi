import { useState } from 'react';
import { Haptics } from '../../core/haptics';
import { BannerPage } from '../../design-system/components/BannerPage';
import { BannerAction } from '../../design-system/components/TransmissionHeader';
import { IconAdd } from '../../design-system/icons';
import { useCapturesStore } from './capturesStore';
import { LinkEditorSheet } from './components/LinkEditorSheet';
import { LinksList } from './components/LinksList';
import { NoteEditorSheet } from './components/NoteEditorSheet';
import { NotesList } from './components/NotesList';
import { SegmentedControl } from './components/SegmentedControl';
import styles from './CapturesHome.module.css';

/**
 * Captures home (/captures, spec §5): mode-dependent ESSI banner with a `+`
 * action, backup reminder, Notes|Links segmented control and the active list.
 * The `+` opens the create editor for the current mode (editors are modal
 * sheets, not routes - spec §2).
 */
export function CapturesHomeView() {
  const mode = useCapturesStore((s) => s.mode);
  const setMode = useCapturesStore((s) => s.setMode);
  const [creating, setCreating] = useState<'note' | 'link' | null>(null);

  const bannerLabel =
    mode === 'notes' ? 'ESSI · Operator Logbook' : 'ESSI · External Comms Cache';

  const onAdd = () => {
    Haptics.tap();
    setCreating(mode === 'notes' ? 'note' : 'link');
  };

  return (
    <>
      <BannerPage
        bannerLabel={bannerLabel}
        bannerActions={
          <BannerAction label={mode === 'notes' ? 'New note' : 'New link'} onTap={onAdd}>
            <IconAdd size={20} />
          </BannerAction>
        }
      >
        <SegmentedControl mode={mode} onChange={setMode} />
        <div className={styles.listArea}>{mode === 'notes' ? <NotesList /> : <LinksList />}</div>
      </BannerPage>

      {creating === 'note' && (
        <NoteEditorSheet initial={null} onClose={() => setCreating(null)} />
      )}
      {creating === 'link' && (
        <LinkEditorSheet initial={null} onClose={() => setCreating(null)} />
      )}
    </>
  );
}
