import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsState } from './settings';

async function freshStore(): Promise<{
  getState: () => SettingsState;
}> {
  vi.resetModules();
  const mod = await import('./settings');
  return mod.useSettingsStore;
}

describe('settings store persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies the spec defaults when localStorage is empty', async () => {
    const store = await freshStore();
    const s = store.getState();
    expect(s.hapticsEnabled).toBe(true);
    expect(s.reduceAnimations).toBe(false);
    expect(s.fastBoot).toBe(false);
    expect(s.onboardingSeen).toBe(false);
    expect(s.lastBackupAt).toBeNull();
    expect(s.backupReminderSnoozedUntil).toBeNull();
    expect(s.autoBackupEnabled).toBe(false);
    expect(s.mapsNetworkEnabled).toBe(true);
    expect(s.mapsAutoUpdate).toBe(true);
    expect(s.mapsLastSeenChangelogVersion).toBeNull();
  });

  it('persists with underdeck.-prefixed SharedPreferences key names', async () => {
    const store = await freshStore();
    store.getState().setOnboardingSeen(true);
    store.getState().setReduceAnimations(true);
    store.getState().setJplProxyUrl('https://proxy.example');
    expect(localStorage.getItem('underdeck.settings.onboardingSeen')).toBe('true');
    expect(localStorage.getItem('underdeck.settings.reduceAnimations')).toBe('true');
    expect(localStorage.getItem('underdeck.settings.jplProxyUrl')).toBe('https://proxy.example');
  });

  it('rehydrates persisted values on a fresh load', async () => {
    localStorage.setItem('underdeck.settings.fastBoot', 'true');
    localStorage.setItem('underdeck.settings.hapticsEnabled', 'false');
    localStorage.setItem('underdeck.settings.lastBackupAt', '1750000000000');
    const store = await freshStore();
    expect(store.getState().fastBoot).toBe(true);
    expect(store.getState().hapticsEnabled).toBe(false);
    expect(store.getState().lastBackupAt).toBe(1_750_000_000_000);
  });

  it('markBackedUp sets lastBackupAt and clears the snooze', async () => {
    const store = await freshStore();
    store.getState().snoozeBackupReminder(999);
    expect(localStorage.getItem('underdeck.settings.backupReminderSnoozedUntil')).toBe('999');
    store.getState().markBackedUp(12345);
    expect(store.getState().lastBackupAt).toBe(12345);
    expect(store.getState().backupReminderSnoozedUntil).toBeNull();
    expect(localStorage.getItem('underdeck.settings.backupReminderSnoozedUntil')).toBeNull();
    expect(localStorage.getItem('underdeck.settings.lastBackupAt')).toBe('12345');
  });

  it('markMapsChangelogSeen ignores empty and unchanged versions', async () => {
    const store = await freshStore();
    store.getState().markMapsChangelogSeen('');
    expect(localStorage.getItem('underdeck.settings.mapsLastSeenChangelogVersion')).toBeNull();
    store.getState().markMapsChangelogSeen('1.2.0');
    expect(store.getState().mapsLastSeenChangelogVersion).toBe('1.2.0');
    expect(localStorage.getItem('underdeck.settings.mapsLastSeenChangelogVersion')).toBe('1.2.0');
  });
});
