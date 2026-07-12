import { useState } from 'react';
import { friendlyError } from '../core/errorText';
import { Haptics } from '../core/haptics';
import { showSnackbar } from '../core/snackbar';
import { exportAndDownload } from '../data/exportImport';
import { useSettingsStore } from '../data/settings';
import { IconBackup } from '../features/captures/components/icons';
import { shouldShowReminder, SNOOZE_DURATION_MS } from '../features/captures/logic';
import { collectBackupStatus } from '../features/captures/queries';
import { useLiveQuery } from '../features/captures/useLiveQuery';
import { IconClose, IconUpload } from '../design-system/icons';
import styles from './BackupReminderFooter.module.css';

/**
 * App-wide "back up your data" footer. Shows on every main-app page (not boot /
 * onboarding) as soon as the user has ANY on-device data - a ship, a note, a
 * link, a map pin, a favourite, scan history… - that has never been exported
 * (or has changed since the last export). "Export" downloads the JSON and marks
 * the data backed up; the ✕ snoozes the reminder for 7 days.
 */
export function BackupReminderFooter() {
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

  const onExport = () => {
    if (exporting) return;
    Haptics.tap();
    setExporting(true);
    void (async () => {
      try {
        await exportAndDownload();
        markBackedUp(); // a completed web download counts as a backup
      } catch (e) {
        showSnackbar(friendlyError(e, 'Export failed. Please try again.'), { danger: true });
      } finally {
        setExporting(false);
      }
    })();
  };

  const onDismiss = () => {
    Haptics.tap();
    snoozeBackupReminder(now + SNOOZE_DURATION_MS);
  };

  return (
    <div className={styles.footer} role="status">
      <span className={styles.icon}>
        <IconBackup size={18} />
      </span>
      <div className={styles.text}>
        <span className={styles.title}>Back up your data</span>
        <span className={styles.sub}>
          It lives only on this device. Export a copy so an uninstall can&apos;t wipe it.
        </span>
      </div>
      <button
        type="button"
        className={styles.export}
        disabled={exporting}
        onClick={onExport}
      >
        <IconUpload size={15} />
        {exporting ? 'Exporting' : 'Export'}
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss backup reminder"
        onClick={onDismiss}
      >
        <IconClose size={16} />
      </button>
    </div>
  );
}
