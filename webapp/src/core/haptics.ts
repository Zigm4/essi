import { useSettingsStore } from '../data/settings';

/**
 * Best-effort web haptics — navigator.vibrate short pulses where supported,
 * silently dropped elsewhere. Gated by settings.hapticsEnabled like the app.
 */
function vibrate(ms: number): void {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

export const Haptics = {
  tap: (): void => vibrate(10),
  selection: (): void => vibrate(5),
  success: (): void => vibrate(20),
  warning: (): void => vibrate(20),
  error: (): void => vibrate(40),
};
