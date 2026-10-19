import { beforeEach, describe, expect, it } from 'vitest';
import { useSnackbarStore } from '../core/snackbar';
import { useSettingsStore } from '../data/settings';
import { CONFIRM_DOWNLOAD_MS, settleExport } from './backupExport';

describe('settleExport', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ lastBackupAt: null, backupReminderSnoozedUntil: 99 });
    useSnackbarStore.setState({ message: null, action: null, persistent: false, durationMs: null });
  });

  it('marks nothing and says nothing when the dialog or sheet was closed', () => {
    settleExport({ kind: 'cancelled' });
    expect(useSettingsStore.getState().lastBackupAt).toBeNull();
    expect(useSettingsStore.getState().backupReminderSnoozedUntil).toBe(99);
    expect(useSnackbarStore.getState().message).toBeNull();
  });

  it('marks the snapshot time once the file was saved or shared', () => {
    settleExport({ kind: 'saved', snapshotAt: 1_000 });
    expect(useSettingsStore.getState().lastBackupAt).toBe(1_000);
    expect(useSnackbarStore.getState().message).toBe('Backup saved.');

    settleExport({ kind: 'shared', snapshotAt: 2_000 });
    expect(useSettingsStore.getState().lastBackupAt).toBe(2_000);
    expect(useSnackbarStore.getState().message).toBe('Backup shared.');
  });

  it('asks after a plain download and marks only on "Yes, saved"', () => {
    settleExport({ kind: 'downloaded', snapshotAt: 3_000 });
    const snack = useSnackbarStore.getState();
    expect(snack.message).toBe('Did the backup file save?');
    expect(snack.durationMs).toBe(CONFIRM_DOWNLOAD_MS);
    expect(useSettingsStore.getState().lastBackupAt).toBeNull();

    snack.action?.onClick();
    expect(snack.action?.label).toBe('Yes, saved');
    expect(useSettingsStore.getState().lastBackupAt).toBe(3_000);
    expect(useSettingsStore.getState().backupReminderSnoozedUntil).toBeNull();
  });
});
