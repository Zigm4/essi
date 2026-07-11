import { showSnackbar } from './snackbar';

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * Allow-list check for URLs that came from importable content.
 * Returns the normalized href when the scheme is http/https/mailto,
 * or null for anything unparseable or disallowed (javascript:, file:, …).
 */
export function allowedExternalUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return null;
  }
  if (!ALLOWED_SCHEMES.has(url.protocol.toLowerCase())) return null;
  return url.href;
}

/**
 * Security-conscious single entry point for opening external URLs.
 * Mirrors lib/core/external_link.dart — disallowed/unopenable links surface
 * the exact "Couldn't open that link." snackbar and nothing else happens.
 */
export function launchExternal(href: string): boolean {
  const url = allowedExternalUrl(href);
  if (url === null) {
    showSnackbar("Couldn't open that link.", { danger: true });
    return false;
  }
  if (url.startsWith('mailto:')) {
    // window.open on mailto leaves a blank tab behind in most browsers.
    window.location.href = url;
    return true;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened === null) {
    showSnackbar("Couldn't open that link.", { danger: true });
    return false;
  }
  return true;
}
