import { showSnackbar } from '../../../core/snackbar';

/**
 * Share adaptation for the web build. The Flutter app rendered an off-screen
 * 380px share-card widget to a 3× PNG and pushed it through the OS share sheet.
 * On the web that needs either a heavy DOM→canvas dependency (html-to-image)
 * or the fragile SVG-foreignObject trick (blocked by strict CSP / web-font
 * tainting). The spec flags these cards mobile-only, so we ship a text share
 * instead: Web Share API when available, clipboard copy otherwise. The card's
 * key facts are folded into `text` so the share stays informative.
 */
export async function shareOrCopy(title: string, text: string): Promise<void> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav !== undefined && typeof nav.share === 'function') {
    try {
      await nav.share({ title, text });
      return;
    } catch (e) {
      // User dismissed the sheet — nothing to do.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Any other share failure falls through to clipboard.
    }
  }
  if (nav !== undefined && nav.clipboard !== undefined) {
    try {
      await nav.clipboard.writeText(text);
      showSnackbar('Copied to clipboard');
      return;
    } catch {
      // Clipboard blocked — final fallback below.
    }
  }
  showSnackbar("Couldn't share right now — try again", { danger: true });
}

/** Copies text to the clipboard, showing the given confirmation snackbar. */
export async function copyToClipboard(text: string, confirmation: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showSnackbar(confirmation);
  } catch {
    showSnackbar("Couldn't copy — try again", { danger: true });
  }
}
