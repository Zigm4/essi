import { useState, type ReactNode } from 'react';
import { GlassCard } from '../../../../design-system/components/GlassCard';
import { ModalLayer } from '../../../../design-system/components/ModalLayer';
import { IconWarningAmber } from '../../../../design-system/icons';
import { Haptics } from '../../../../core/haptics';
import { showSnackbar } from '../../../../core/snackbar';
import type { HistoryRow } from '../../../../data/db';
import {
  clearHistory,
  deleteHistoryRow,
  restoreHistoryRow,
  useHistory,
  type HistoryKind,
} from '../history';
import { Spinner } from './kit';
import { IconDelete, IconHistory } from './toolIcons';
import styles from './nasa.module.css';

/**
 * Cross-view building blocks for the three NASA tool screens: a confirm dialog,
 * transparency bullet rows, and the generic history bottom sheet (spec §3.3).
 * The dialog and the sheet are modal layers: Back / Escape close the top-most
 * one, focus moves in and comes back on close (ModalLayer).
 */

// --- Confirm dialog (clear-all / single-delete) ------------------------------

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalLayer onClose={onCancel}>
      <div className={styles.dialogScrim} onClick={onCancel} role="presentation">
        <div
          className={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={styles.headline}>{title}</span>
          {message !== undefined && <span className={styles.caption}>{message}</span>}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogBtn}
              style={{ color: 'var(--text-secondary)' }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dialogBtn}
              style={{ color: 'var(--accent-danger)' }}
              onClick={() => {
                Haptics.warning();
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}

// --- Transparency bullet row (spec §4.2 / §5.1) ------------------------------

export function BulletRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.bulletRow}>
      <span className={styles.bulletLabel}>{label}</span>
      <span className={styles.bulletValue}>{value}</span>
    </div>
  );
}

// --- Generic history bottom sheet (spec §3.3) --------------------------------

export interface HistorySheetStrings {
  title: string;
  emptyTitle: string;
  emptySubtitle?: string;
  errorTitle: string;
  clearTitle: string;
  clearMessage: string;
  deleteTitle: string;
}

/** Corrupted-payload tile (spec §3.3). Tap deletes it (with Undo). */
function CorruptedTile({ onDelete }: { onDelete: () => void }) {
  return (
    <GlassCard onTap={onDelete} ariaLabel="Corrupted entry">
      <div className={styles.rowCenter} style={{ gap: 12 }}>
        <span style={{ color: 'var(--accent-danger)', display: 'inline-flex', opacity: 0.8 }}>
          <IconWarningAmber size={18} />
        </span>
        <span>
          <span className={styles.body} style={{ display: 'block' }}>
            Corrupted entry
          </span>
          <span className={styles.caption} style={{ display: 'block', marginTop: 2 }}>
            Tap to delete this entry.
          </span>
        </span>
      </div>
    </GlassCard>
  );
}

/**
 * The shared history sheet: draggable-modal chrome, loading/empty/error/data
 * bodies, the clear-all confirm and single deletes. `renderRow` builds a
 * tool-specific row and may throw on a corrupt payload (→ corrupted tile).
 * Each row has a visible delete button (right-click works too, but iOS Safari
 * never fires contextmenu); a delete happens at once with an Undo snackbar.
 */
export function HistorySheet({
  kind,
  strings,
  onClose,
  renderRow,
}: {
  kind: HistoryKind;
  strings: HistorySheetStrings;
  onClose: () => void;
  renderRow: (row: HistoryRow) => ReactNode;
}) {
  const feed = useHistory(kind);
  const [showClear, setShowClear] = useState(false);

  const deleteRow = async (id: string) => {
    Haptics.selection();
    try {
      const row = await deleteHistoryRow(kind, id);
      showSnackbar('Entry deleted.', {
        action:
          row === undefined
            ? undefined
            : {
                label: 'Undo',
                onClick: () => {
                  void restoreHistoryRow(kind, row).catch(() =>
                    showSnackbar("Couldn't restore the entry.", { danger: true }),
                  );
                },
              },
      });
    } catch {
      showSnackbar("Couldn't delete the entry.", { danger: true });
    }
  };

  const hasRows = feed.status === 'data' && feed.rows.length > 0;
  const showDeleteAll = hasRows || feed.status === 'error';

  return (
    <ModalLayer onClose={onClose}>
      <div className={styles.sheetScrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={strings.title} tabIndex={-1}>
        <div className={styles.sheetAppBar}>
          <button type="button" className={styles.sheetDone} onClick={onClose}>
            Done
          </button>
          <span className={styles.sheetTitle}>{strings.title}</span>
          {showDeleteAll && (
            <button
              type="button"
              className={styles.iconBtn}
              style={{ marginLeft: 'auto', color: 'var(--accent-danger)' }}
              title={strings.clearTitle}
              aria-label={strings.clearTitle}
              onClick={() => setShowClear(true)}
            >
              <IconDelete size={22} />
            </button>
          )}
        </div>

        {feed.status === 'loading' && (
          <div className={styles.sheetCentered}>
            <Spinner size={28} />
          </div>
        )}

        {feed.status === 'error' && (
          <div className={styles.sheetCentered}>
            <span style={{ color: 'var(--accent-danger)', opacity: 0.6 }}>
              <IconWarningAmber size={48} />
            </span>
            <span className={styles.headline}>{strings.errorTitle}</span>
            <span className={styles.caption}>
              Some saved data may be corrupted. Use the delete button above to clear history and
              recover.
            </span>
          </div>
        )}

        {feed.status === 'data' && feed.rows.length === 0 && (
          <div className={styles.sheetCentered}>
            <span style={{ color: 'var(--accent-primary)', opacity: 0.4 }}>
              <IconHistory size={48} />
            </span>
            <span className={styles.headline}>{strings.emptyTitle}</span>
            {strings.emptySubtitle !== undefined && (
              <span className={styles.caption}>{strings.emptySubtitle}</span>
            )}
          </div>
        )}

        {feed.status === 'data' && feed.rows.length > 0 && (
          <div className={styles.sheetBody}>
            {feed.rows.map((row) => {
              let content: ReactNode;
              let corrupted = false;
              try {
                content = renderRow(row);
              } catch {
                corrupted = true;
              }
              return (
                <div
                  key={row.id}
                  className={styles.historyRow}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void deleteRow(row.id);
                  }}
                >
                  <div className={styles.historyRowMain}>
                    {corrupted ? <CorruptedTile onDelete={() => void deleteRow(row.id)} /> : content}
                  </div>
                  {!corrupted && (
                    <button
                      type="button"
                      className={styles.historyRowDelete}
                      title={strings.deleteTitle.replace(/\?$/, '')}
                      aria-label={strings.deleteTitle.replace(/\?$/, '')}
                      onClick={() => void deleteRow(row.id)}
                    >
                      <IconDelete size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showClear && (
        <ConfirmDialog
          title={strings.clearTitle}
          message={strings.clearMessage}
          confirmLabel="Delete all"
          onCancel={() => setShowClear(false)}
          onConfirm={() => {
            setShowClear(false);
            void clearHistory(kind);
          }}
        />
      )}
    </ModalLayer>
  );
}
