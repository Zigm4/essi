import { showSnackbar } from '../../../core/snackbar';
import type { CardSpec } from './shareCard';

/**
 * What a result can be shared as: a Discord-ready message (with the link at
 * the end), a PNG card drawn like the app, and a link that reopens the result.
 */
export interface ShareContent {
  /** Share-sheet / OS share title, e.g. "ESSI tracker". */
  title: string;
  /** Discord markdown, under Discord's 2000-character limit, ending with the link. */
  discordText: string;
  /** Absolute URL that reopens this result in ESSI. */
  link: string;
  card: CardSpec;
  /** PNG file name, e.g. `essi-track-1760000000000.png`. */
  fileName: string;
}

/** Discord's message limit, with headroom. */
export const DISCORD_MAX = 1900;

/** Absolute URL of an in-app route (hash router), e.g. `/tools/tracker?snap=…`. */
export function appLink(route: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  return `${base}#${route.startsWith('/') ? route : `/${route}`}`;
}

/** `<url>` stops Discord from adding a (useless, site-wide) link preview. */
export function discordLink(url: string): string {
  return `<${url}>`;
}

export async function copyText(text: string, confirmation: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    showSnackbar(confirmation);
    return true;
  } catch {
    showSnackbar("Couldn't copy - try again", { danger: true });
    return false;
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True when the OS share sheet can take an image file (most phones). */
export function canShareImageFile(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function canCopyImage(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ClipboardItem === 'function' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/**
 * Shares the card image: the OS share sheet when it accepts files (phones -
 * pick Discord there), else copies the image to the clipboard (paste it in
 * Discord) with a Download action, else downloads the file. Must be called
 * from the tap itself (the image is pre-rendered when the sheet opens) so the
 * browser still counts it as a user gesture.
 */
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<void> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (canShareImageFile()) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Any other failure falls through to the clipboard / download.
    }
  }
  if (canCopyImage()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showSnackbar('Image copied - paste it in Discord.', {
        action: { label: 'Download', onClick: () => downloadBlob(blob, fileName) },
      });
      return;
    } catch {
      // Clipboard refused (permissions, unsupported type) - download instead.
    }
  }
  downloadBlob(blob, fileName);
  showSnackbar('Image downloaded.');
}
