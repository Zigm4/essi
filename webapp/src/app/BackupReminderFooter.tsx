import { useState } from 'react';
import { Haptics } from '../core/haptics';
import { useSettingsStore } from '../data/settings';
import { IconBackup } from '../features/captures/components/icons';
import { shouldShowReminder, SNOOZE_DURATION_MS } from '../features/captures/logic';
import { collectBackupStatus } from '../features/captures/queries';
import { useLiveQuery } from '../features/captures/useLiveQuery';
import { IconClose, IconUpload } from '../design-system/icons';
import { runBackupExport } from './backupExport';
import styles from './BackupReminderFooter.module.css';

/**
 * App-wide "back up your data" footer. Shows on every main-app page (not boot /
 * onboarding) as soon as the user has ANY on-device data - a ship, a note, a
 * link, a map pin, a favourite, scan history… - that has never been exported
 * (or has changed since, deletions and imports included). "Export" saves the
 * JSON and the reminder goes once the file is known to exist (see
 * runBackupExport); the ✕ snoozes it for 7 days. It sits in the shell's flow
 * above the bottom nav, so it never hides the end of a page.
 */
export function BackupReminderFooter() {
  const statusResult = useLiveQuery(collectBackupStatus, []);
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt);
  const snoozedUntil = useSettingsStore((s) => s.backupReminderSnoozedUntil);
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
    void runBackupExport().finally(() => setExporting(false));
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
          It lives only on this device.
          <span className={styles.subMore}> Export a copy so an uninstall can&apos;t wipe it.</span>
        </span>
      </div>
      <button
        type="button"
        className={styles.export}
        disabled={exporting}
        onClick={onExport}
      >
        <span className={styles.exportIcon}>
          <IconUpload size={15} />
        </span>
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
