import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../../../design-system/components/GlassCard';
import { NeonButton } from '../../../../design-system/components/NeonButton';
import { IconWarningAmber, IconWifiTethering } from '../../../../design-system/icons';
import { Haptics } from '../../../../core/haptics';
import type { HistoryRow } from '../../../../data/db';
import { clearHistory, deleteHistoryRow, useHistory, type HistoryKind } from '../history';
import { Spinner } from './kit';
import { IconDelete, IconHistory } from './toolIcons';
import styles from './nasa.module.css';

/**
 * Cross-view building blocks for the three NASA tool screens: the
 * empty-proxy notice, a confirm dialog, transparency bullet rows, and the
 * generic history bottom sheet (spec §3.3).
 */

// --- Empty-proxy state (web-only; spec §11 open question #1) ------------------

/**
 * Shown in place of the action button when `settings.jplProxyUrl` is blank, so
 * no network call is ever attempted. Links to Settings where the proxy is set.
 */
export function ProxyNotice() {
  const navigate = useNavigate();
  return (
    <GlassCard>
      <div className={styles.rowCenter} style={{ gap: 8 }}>
        <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
          <IconWifiTethering size={18} />
        </span>
        <span className={styles.headline}>Network access not configured</span>
      </div>
      <div className={styles.caption} style={{ marginTop: 8 }}>
        This tool reaches NASA&apos;s JPL servers, which browsers can&apos;t call directly. Configure
        the JPL proxy URL in Settings to enable it.
      </div>
      <NeonButton
        className={styles.proxyButton}
        title="Open Settings"
        onPressed={() => navigate('/menu/settings')}
      />
    </GlassCard>
  );
}

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
    <>
      <div className={styles.dialogScrim} onClick={onCancel} role="presentation">
        <div className={styles.dialog} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
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
    </>
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

/** Corrupted-payload tile (spec §3.3). Tap opens the single-delete confirm. */
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
 * bodies, and the clear-all + single-delete confirm flows. `renderRow` builds a
 * tool-specific row and may throw on a corrupt payload (→ corrupted tile).
 * Right-click / long-press a row opens the single-delete confirm.
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const hasRows = feed.status === 'data' && feed.rows.length > 0;
  const showDeleteAll = hasRows || feed.status === 'error';

  return (
    <>
      <div className={styles.sheetScrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-label={strings.title}>
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDeleteId(row.id);
                  }}
                >
                  {corrupted ? <CorruptedTile onDelete={() => setDeleteId(row.id)} /> : content}
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

      {deleteId !== null && (
        <ConfirmDialog
          title={strings.deleteTitle}
          confirmLabel="Delete"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            const id = deleteId;
            setDeleteId(null);
            void deleteHistoryRow(kind, id);
          }}
        />
      )}
    </>
  );
}
