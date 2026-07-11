import { create } from 'zustand';

/**
 * App settings — mirrors lib/services/app_settings.dart (app-shell spec §15).
 * Persisted per-key in localStorage with the SharedPreferences key names,
 * prefixed `underdeck.`. Booleans as 'true'/'false', dates as epoch-ms
 * numbers stringified, strings raw.
 */

const PREFIX = 'underdeck.';

export const SETTINGS_KEYS = {
  hapticsEnabled: 'settings.hapticsEnabled',
  reduceAnimations: 'settings.reduceAnimations',
  fastBoot: 'settings.fastBoot',
  onboardingSeen: 'settings.onboardingSeen',
  lastBackupAt: 'settings.lastBackupAt',
  backupReminderSnoozedUntil: 'settings.backupReminderSnoozedUntil',
  autoBackupEnabled: 'settings.autoBackupEnabled',
  mapsNetworkEnabled: 'settings.mapsNetworkEnabled',
  mapsAutoUpdate: 'settings.mapsAutoUpdate',
  mapsLastSeenChangelogVersion: 'settings.mapsLastSeenChangelogVersion',
  /** Web-only: base URL of the personal Cloudflare Worker proxying JPL/NASA. */
  jplProxyUrl: 'settings.jplProxyUrl',
} as const;

function storageKey(key: string): string {
  return PREFIX + key;
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(storageKey(key));
  return raw === null ? fallback : raw === 'true';
}

function readIntOrNull(key: string): number | null {
  const raw = localStorage.getItem(storageKey(key));
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function readStringOrNull(key: string): string | null {
  return localStorage.getItem(storageKey(key));
}

function write(key: string, value: boolean | number | string): void {
  localStorage.setItem(storageKey(key), String(value));
}

function remove(key: string): void {
  localStorage.removeItem(storageKey(key));
}

export interface SettingsState {
  hapticsEnabled: boolean;
  reduceAnimations: boolean;
  fastBoot: boolean;
  onboardingSeen: boolean;
  /** Epoch ms of the last successful export/backup, null = never. */
  lastBackupAt: number | null;
  /** Epoch ms until which the backup reminder is snoozed. */
  backupReminderSnoozedUntil: number | null;
  autoBackupEnabled: boolean;
  mapsNetworkEnabled: boolean;
  mapsAutoUpdate: boolean;
  mapsLastSeenChangelogVersion: string | null;
  jplProxyUrl: string;

  setHapticsEnabled: (v: boolean) => void;
  setReduceAnimations: (v: boolean) => void;
  setFastBoot: (v: boolean) => void;
  setOnboardingSeen: (v: boolean) => void;
  setAutoBackupEnabled: (v: boolean) => void;
  setMapsNetworkEnabled: (v: boolean) => void;
  setMapsAutoUpdate: (v: boolean) => void;
  setJplProxyUrl: (url: string) => void;
  /** Sets lastBackupAt and clears any snooze so the reminder timer restarts. */
  markBackedUp: (at?: number) => void;
  snoozeBackupReminder: (until: number) => void;
  /** No-op when the version is empty or unchanged. */
  markMapsChangelogSeen: (version: string) => void;
}

function initialJplProxyUrl(): string {
  const stored = readStringOrNull(SETTINGS_KEYS.jplProxyUrl);
  if (stored !== null) return stored;
  const fromEnv: unknown = import.meta.env.VITE_JPL_PROXY_URL;
  return typeof fromEnv === 'string' ? fromEnv : '';
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hapticsEnabled: readBool(SETTINGS_KEYS.hapticsEnabled, true),
  reduceAnimations: readBool(SETTINGS_KEYS.reduceAnimations, false),
  fastBoot: readBool(SETTINGS_KEYS.fastBoot, false),
  onboardingSeen: readBool(SETTINGS_KEYS.onboardingSeen, false),
  lastBackupAt: readIntOrNull(SETTINGS_KEYS.lastBackupAt),
  backupReminderSnoozedUntil: readIntOrNull(SETTINGS_KEYS.backupReminderSnoozedUntil),
  autoBackupEnabled: readBool(SETTINGS_KEYS.autoBackupEnabled, false),
  mapsNetworkEnabled: readBool(SETTINGS_KEYS.mapsNetworkEnabled, true),
  mapsAutoUpdate: readBool(SETTINGS_KEYS.mapsAutoUpdate, true),
  mapsLastSeenChangelogVersion: readStringOrNull(SETTINGS_KEYS.mapsLastSeenChangelogVersion),
  jplProxyUrl: initialJplProxyUrl(),

  setHapticsEnabled: (v) => {
    write(SETTINGS_KEYS.hapticsEnabled, v);
    set({ hapticsEnabled: v });
  },
  setReduceAnimations: (v) => {
    write(SETTINGS_KEYS.reduceAnimations, v);
    set({ reduceAnimations: v });
  },
  setFastBoot: (v) => {
    write(SETTINGS_KEYS.fastBoot, v);
    set({ fastBoot: v });
  },
  setOnboardingSeen: (v) => {
    write(SETTINGS_KEYS.onboardingSeen, v);
    set({ onboardingSeen: v });
  },
  setAutoBackupEnabled: (v) => {
    write(SETTINGS_KEYS.autoBackupEnabled, v);
    set({ autoBackupEnabled: v });
  },
  setMapsNetworkEnabled: (v) => {
    write(SETTINGS_KEYS.mapsNetworkEnabled, v);
    set({ mapsNetworkEnabled: v });
  },
  setMapsAutoUpdate: (v) => {
    write(SETTINGS_KEYS.mapsAutoUpdate, v);
    set({ mapsAutoUpdate: v });
  },
  setJplProxyUrl: (url) => {
    write(SETTINGS_KEYS.jplProxyUrl, url);
    set({ jplProxyUrl: url });
  },
  markBackedUp: (at) => {
    const stamp = at ?? Date.now();
    write(SETTINGS_KEYS.lastBackupAt, stamp);
    remove(SETTINGS_KEYS.backupReminderSnoozedUntil);
    set({ lastBackupAt: stamp, backupReminderSnoozedUntil: null });
  },
  snoozeBackupReminder: (until) => {
    write(SETTINGS_KEYS.backupReminderSnoozedUntil, until);
    set({ backupReminderSnoozedUntil: until });
  },
  markMapsChangelogSeen: (version) => {
    if (version.length === 0 || version === get().mapsLastSeenChangelogVersion) return;
    write(SETTINGS_KEYS.mapsLastSeenChangelogVersion, version);
    set({ mapsLastSeenChangelogVersion: version });
  },
}));
