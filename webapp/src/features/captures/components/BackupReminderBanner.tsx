import { useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { Haptics } from '../../../core/haptics';
import { showSnackbar } from '../../../core/snackbar';
import { exportAndDownload } from '../../../data/exportImport';
import { useSettingsStore } from '../../../data/settings';
import { IconClose, IconUpload } from '../../../design-system/icons';
import { lastBackupLabel, shouldShowReminder, SNOOZE_DURATION_MS } from '../logic';
import { collectBackupStatus } from '../queries';
import { useLiveQuery } from '../useLiveQuery';
import { IconBackup } from './icons';
import styles from './BackupReminderBanner.module.css';

/**
 * BackupReminderBanner (spec §17). Renders nothing unless a backup reminder is
 * due. "Export now" downloads the JSON export and marks the data backed up;
 * "Later"/✕ snooze the reminder for 7 days.
 */
export function BackupReminderBanner() {
  const statusResult = useLiveQuery(collectBackupStatus, []);
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt);
  const snoozedUntil = useSettingsStore((s) => s.backupReminderSnoozedUntil);
  const markBackedUp = useSettingsStore((s) => s.markBackedUp);
  const snoozeBackupReminder = useSettingsStore((s) => s.snoozeBackupReminder);
  const [exporting, setExporting] = useState(false);

  const status = statusResult.data;
  if (status === undefined) return null;

  const now = Date.now();
  if (!shouldShowReminder({ status, lastBackupAt, snoozedUntil, now })) return null;

  const label = lastBackupLabel(lastBackupAt, now);

  const onExport = () => {
    if (exporting) return;
    Haptics.tap();
    setExporting(true);
    void (async () => {
      try {
        await exportAndDownload();
        // A completed web download counts as a backup (spec §17 adaptation).
        markBackedUp();
      } catch (e) {
        showSnackbar(friendlyError(e, 'Export failed. Please try again.'), { danger: true });
      } finally {
        setExporting(false);
      }
    })();
  };

  const onSnooze = () => {
    Haptics.tap();
    snoozeBackupReminder(now + SNOOZE_DURATION_MS);
  };

  return (
    <div className={styles.banner}>
      <span className={styles.leadingIcon}>
        <IconBackup size={20} />
      </span>
      <div className={styles.content}>
        <div className={styles.title}>Back up your data</div>
        <div className={styles.caption}>
          Everything lives on this device only — {label}. Export a copy so an uninstall can't wipe
          it.
        </div>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${styles.primaryButton} ${exporting ? styles.busy : ''}`}
            disabled={exporting}
            onClick={onExport}
          >
            <IconUpload size={16} />
            {exporting ? 'Exporting…' : 'Export now'}
          </button>
          <button type="button" className={styles.subtleButton} onClick={onSnooze}>
            Later
          </button>
        </div>
      </div>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss backup reminder"
        onClick={onSnooze}
      >
        <IconClose size={18} />
      </button>
    </div>
  );
}
