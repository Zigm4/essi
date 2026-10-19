import { friendlyError } from '../core/errorText';
import { showSnackbar } from '../core/snackbar';
import { exportBackup, type ExportOutcome } from '../data/exportImport';
import { useSettingsStore } from '../data/settings';

/** The "did it save?" question stays long enough to deal with a browser save prompt. */
export const CONFIRM_DOWNLOAD_MS = 20_000;

/**
 * Turns an export outcome into feedback. Data counts as backed up only on
 * evidence: the save dialog wrote the file, the share sheet took it, or - for a
 * plain download the browser may have dropped - the user taps "Yes, saved".
 * A closed dialog or sheet changes nothing and says nothing.
 */
export function settleExport(outcome: ExportOutcome): void {
  const { markBackedUp } = useSettingsStore.getState();
  switch (outcome.kind) {
    case 'cancelled':
      return;
    case 'saved':
      markBackedUp(outcome.snapshotAt);
      showSnackbar('Backup saved.');
      return;
    case 'shared':
      markBackedUp(outcome.snapshotAt);
      showSnackbar('Backup shared.');
      return;
    case 'downloaded':
      showSnackbar('Did the backup file save?', {
        durationMs: CONFIRM_DOWNLOAD_MS,
        action: { label: 'Yes, saved', onClick: () => markBackedUp(outcome.snapshotAt) },
      });
  }
}

/** Settings › Data › Export and the backup reminder's Export button. */
export async function runBackupExport(): Promise<void> {
  try {
    settleExport(await exportBackup());
  } catch (e) {
    showSnackbar(friendlyError(e, 'Export failed. Please try again.'), { danger: true });
  }
}
