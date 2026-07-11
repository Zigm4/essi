import { useState, type ReactElement } from 'react';
import { BannerPage } from '../../design-system/components/BannerPage';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { TerminalNotes } from '../../design-system/components/TerminalNotes';
import { BannerAction } from '../../design-system/components/TransmissionHeader';
import { IconAdd, IconHelpOutline, IconRocketLaunch, type IconProps } from '../../design-system/icons';
import { Haptics } from '../../core/haptics';
import { friendlyError } from '../../core/errorText';
import { showSnackbar } from '../../core/snackbar';
import { useCatalogs } from './catalog';
import { ConfirmDialog } from './ConfirmDialog';
import { IconArchive, IconDirectionsCar, IconSailing } from './hangarIcons';
import { ShipCard } from './ShipCard';
import { ShipEditor } from './ShipEditor';
import { groupShips, type ShipCategory, type ShipModel } from './shipModel';
import { deleteShip, useShips } from './shipRepository';
import styles from './hangar.module.css';

/** Terminal notes shown at the bottom of the hangar list (spec §5.4). */
const HANGAR_NOTES: string[] = [
  'To locate a ship, type its entry command in #verified-perk-room and match the APM shown to a known place.',
  'A ship can be recalled at any time, but at a heavy stamina cost.',
  'To register a ship, just try to board it once. Spacecraft spawn at Mars space station, the Rat Raft at Rankle River; other vessels vary.',
];

const CATEGORY_META: Record<
  ShipCategory,
  { label: string; Icon: (p: IconProps) => ReactElement }
> = {
  landcraft: { label: 'LANDCRAFT', Icon: IconDirectionsCar },
  watercraft: { label: 'WATERCRAFT', Icon: IconSailing },
  spacecraft: { label: 'SPACECRAFT', Icon: IconRocketLaunch },
  other: { label: 'OTHER', Icon: IconHelpOutline },
};

type EditorState = { open: false } | { open: true; ship: ShipModel | null };

/** /hangar — ship registry (Hangar tab). */
export function HangarListView() {
  const catalogState = useCatalogs();
  const catalog = catalogState.status === 'ready' ? catalogState.data : null;
  const shipsState = useShips();
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<ShipModel | null>(null);

  const openNew = () => {
    Haptics.tap();
    setEditor({ open: true, ship: null });
  };

  const confirmDelete = async () => {
    const ship = pendingDelete;
    setPendingDelete(null);
    if (ship == null) return;
    Haptics.warning();
    try {
      await deleteShip(ship.id);
    } catch (err) {
      console.error('Failed to delete ship:', err);
      showSnackbar(friendlyError(err), { danger: true });
    }
  };

  let content: ReactElement;
  if (shipsState.status === 'loading') {
    content = (
      <div className={styles.listCentered}>
        <span className={styles.spinner} aria-label="Loading" />
      </div>
    );
  } else if (shipsState.status === 'error') {
    content = (
      <div className={styles.listCentered}>
        <span className={styles.listError}>Couldn't load your hangar.</span>
      </div>
    );
  } else {
    const ships = shipsState.data;
    const groups = groupShips(ships, catalog);
    content = (
      <>
        {ships.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <IconArchive size={48} />
            </span>
            <span className={styles.emptyTitle}>Hangar empty</span>
            <span className={styles.emptyHint}>Tap + to register your first ship.</span>
          </div>
        ) : (
          groups.map((group) => {
            const meta = CATEGORY_META[group.category];
            return (
              <div key={group.category} className={styles.categoryBlock}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryIcon}>
                    <meta.Icon size={18} />
                  </span>
                  <span className={styles.categoryLabel}>{meta.label}</span>
                  <span className={styles.categoryCount}>· {group.ships.length}</span>
                </div>
                {group.ships.map((ship) => (
                  <div key={ship.id} className={styles.cardSlot}>
                    <ShipCard
                      model={ship}
                      catalog={catalog}
                      onOpen={() => setEditor({ open: true, ship })}
                      onDelete={() => setPendingDelete(ship)}
                    />
                  </div>
                ))}
              </div>
            );
          })
        )}
        <div className={styles.notesSpacer} />
        <TerminalNotes title="hangar.notes" lines={HANGAR_NOTES} />
      </>
    );
  }

  return (
    <>
      <BannerPage
        bannerLabel="ESSI · Fleet Registry"
        bannerActions={
          <BannerAction label="Add ship" onTap={openNew}>
            <IconAdd size={20} />
          </BannerAction>
        }
      >
        <PageScrollView padding="12px 12px 32px">{content}</PageScrollView>
      </BannerPage>

      {editor.open && (
        <ShipEditor initial={editor.ship} onClose={() => setEditor({ open: false })} />
      )}

      {pendingDelete != null && (
        <ConfirmDialog
          title="Delete ship?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}
