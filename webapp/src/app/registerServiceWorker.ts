import { registerSW } from 'virtual:pwa-register';
import { showSnackbar } from '../core/snackbar';

/**
 * Registers the service worker that precaches the app and its data (offline
 * use). A new version is installed in the background but only takes over when
 * the user taps "Reload", so it never swaps code and data under an open editor.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      showSnackbar('A new version of ESSI is ready.', {
        persistent: true,
        action: { label: 'Reload', onClick: () => void updateSW(true) },
      });
    },
    onOfflineReady() {
      showSnackbar('ESSI is ready to work offline.');
    },
  });
}
