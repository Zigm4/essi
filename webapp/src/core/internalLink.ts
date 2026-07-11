import { launchExternal } from './externalLink';

/**
 * Resolves the custom in-app scheme `underdeck://` used by cross-links inside
 * content (KB markdown, zone links, imported notes). Never registered with the
 * OS — resolved purely in-app (app-shell spec §13.5).
 *
 *   underdeck://kb/<slug>            -> /knowledge/article/<slug>
 *   underdeck://map/<id>[?zone=<z>]  -> /knowledge/maps/<id>[?zone=<z>]
 */
export function resolveInternalLink(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return null;
  }
  if (url.protocol.toLowerCase() !== 'underdeck:') return null;
  const kind = url.host.toLowerCase();
  const id = url.pathname.split('/').find((s) => s.length > 0);
  if (id === undefined) return null;
  switch (kind) {
    case 'kb':
      return `/knowledge/article/${id}`;
    case 'map': {
      const zone = url.searchParams.get('zone');
      const suffix = zone !== null && zone.length > 0 ? `?zone=${encodeURIComponent(zone)}` : '';
      return `/knowledge/maps/${id}${suffix}`;
    }
    default:
      return null;
  }
}

/**
 * Resolve-and-follow: internal links push an in-app route; everything else is
 * handed to the external allow-list (so javascript:/file: can never launch).
 */
export function resolveLink(href: string, navigate: (to: string) => void): void {
  const path = resolveInternalLink(href);
  if (path !== null) {
    navigate(path);
  } else {
    launchExternal(href);
  }
}
