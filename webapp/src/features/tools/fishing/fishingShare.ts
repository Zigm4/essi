/**
 * Share content for a Fishing Map zone, in the same three forms as the NASA
 * tools and Jobs: a Discord message (an ESSI "transmission"), a PNG card and
 * a link.
 *
 * The link opens the zone's room; for a zone of the grid (Rankle River) it
 * adds `?zone=<id>`, which opens that zone's card on arrival.
 */

import { appLink, escapeDiscord, type ShareContent } from '../shared/shareActions';
import type { CardSpec } from '../shared/shareCard';
import { transmission } from '../shared/transmission';
import { depthFromName, roomDisplayName, zoneFactRows, type FishingZone } from './fishingData';

const SITE = 'zigm4.github.io/essi';
const SIGN_OFF = 'Fisheries Office, East Shire Space Industries (ESSI)';

/**
 * The link that reopens a zone.
 * @param inGrid the zone is a cell of a multi-zone room (the link opens its card)
 */
export function fishingZoneRoute(zone: FishingZone, inGrid: boolean): string {
  const room = `/tools/fishing/${encodeURIComponent(zone.room)}`;
  return inGrid ? `${room}?zone=${zone.id}` : room;
}

/** The zone a link opens (`?zone=<id>`), or null. */
export function zoneIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('zone');
  if (raw === null || !/^\d{1,6}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Zones still waiting for a name are called "Unknown" in the data. */
function hasName(zone: FishingZone): boolean {
  return zone.name.trim().length > 0 && zone.name !== 'Unknown';
}

/**
 * @param showsZoneNumber the zone is a cell of a grid room (Rankle River), as
 *   on its card: the number is shown and the link opens it on the grid
 */
export function fishingZoneShare(zone: FishingZone, showsZoneNumber: boolean): ShareContent {
  const link = appLink(fishingZoneRoute(zone, showsZoneNumber));
  const room = roomDisplayName(zone.room);
  const rows = zoneFactRows(zone);
  const depth = depthFromName(zone.depth);
  const name = escapeDiscord(zone.name);

  const intro = !showsZoneNumber
    ? `The Fisheries Office has charted the **${name}** fishing spot.`
    : hasName(zone)
      ? `The Fisheries Office has charted zone **${zone.id}** of ${escapeDiscord(room)}: **${name}**.`
      : `The Fisheries Office has charted zone **${zone.id}** of ${escapeDiscord(room)}. Its name is not known yet.`;
  const discordText = transmission({
    header: '🎣 ESSI · Fishing report',
    division: `Fisheries Office · ${room}`,
    intro,
    body: ['**Zone survey**', ...rows.map((r) => `- **${r.label}:** ${escapeDiscord(r.value)}`)],
    linkLabel: 'Open this zone in ESSI',
    link,
    signOff: SIGN_OFF,
  });

  // The image is the zone card: name and depth circle, then the same rows.
  const card: CardSpec = {
    title: 'ESSI · Fishing zone',
    subtitle: room,
    blocks: [
      {
        kind: 'hero',
        emoji: '🎣',
        title: zone.name,
        caption: showsZoneNumber ? `Zone ${zone.id}` : 'Single zone',
        ...(depth !== null ? { dot: depth.color } : {}),
      },
      { kind: 'space', height: 8 },
      { kind: 'panel', items: [{ kind: 'facts', rows: rows.map((r) => ({ label: r.label, value: r.value })) }] },
    ],
    footer: `ESSI · Fisheries Office · ${SITE}`,
  };

  const where = showsZoneNumber ? `Zone ${zone.id}, ${room}` : room;
  return {
    title: `ESSI fishing report: ${showsZoneNumber ? `zone ${zone.id}` : zone.name}`,
    caption: `🎣 ESSI fishing report · ${showsZoneNumber ? `${zone.name} (${where})` : where}\n${rows
      .map((r) => `${r.label} ${r.value}`)
      .join(' · ')}`,
    discordText,
    link,
    card,
    fileName: `essi-fishing-zone-${zone.id}.png`,
  };
}
