import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCORD_MAX } from '../shared/shareActions';
import { buildRooms, parseFishingZones, zoneFactRows, type FishingZone } from './fishingData';
import { fishingZoneRoute, fishingZoneShare, zoneIdFromSearch } from './fishingShare';

const zones = parseFishingZones(
  JSON.parse(
    // jsdom environment (appLink reads window.location): read the real data by path.
    readFileSync(resolve(process.cwd(), 'public/catalog/fishing_zones.json'), 'utf-8'),
  ) as unknown,
);
const rooms = buildRooms(zones);
const byId = (id: number): FishingZone => zones.find((z) => z.id === id)!;

/** The query of an app link (`…/#/tools/fishing/rankle-river?zone=…`). */
function linkSearch(link: string): string {
  return link.slice(link.indexOf('?'));
}

describe('fishing links', () => {
  it('opens a grid zone on its room, and a single-zone room as is', () => {
    expect(fishingZoneRoute(byId(49), true)).toBe('/tools/fishing/rankle-river?zone=49');
    expect(fishingZoneRoute(byId(998), false)).toBe('/tools/fishing/east-shire');
    const share = fishingZoneShare(byId(49), true);
    expect(share.link).toContain('#/tools/fishing/rankle-river?zone=49');
    expect(zoneIdFromSearch(linkSearch(share.link))).toBe(49);
    expect(fishingZoneShare(byId(998), false).link).toMatch(/#\/tools\/fishing\/east-shire$/);
  });

  it('reads only a zone number', () => {
    expect(zoneIdFromSearch('?zone=7')).toBe(7);
    expect(zoneIdFromSearch('?zone=x')).toBeNull();
    expect(zoneIdFromSearch('?zone=')).toBeNull();
    expect(zoneIdFromSearch('')).toBeNull();
  });
});

describe('fishingZoneShare', () => {
  it('writes a fishing report with the zone card rows', () => {
    const share = fishingZoneShare(byId(49), true);
    const text = share.discordText;
    expect(text.startsWith('### 🎣 ESSI · Fishing report\n-# Fisheries Office · Rankle River')).toBe(true);
    expect(text).toContain("charted zone **49** of Rankle River: **Marooner's Mooring**.");
    expect(text).toContain('- **Accessible:** Yes\n- **Depth:** Harbour\n- **Pole:** Pink');
    expect(text).toContain(`[Open this zone in ESSI](<${share.link}>)`);
    expect(text.endsWith('Fisheries Office, East Shire Space Industries (ESSI)')).toBe(true);
    expect(share.caption).toBe(
      "🎣 ESSI fishing report · Marooner's Mooring (Zone 49, Rankle River)\nAccessible Yes · Depth Harbour · Pole Pink",
    );
    expect(share.fileName).toBe('essi-fishing-zone-49.png');
  });

  it('words unnamed zones, reefs and single-zone rooms', () => {
    expect(fishingZoneShare(byId(1), true).discordText).toContain('zone **1** of Rankle River. Its name is not known yet.');
    expect(fishingZoneShare(byId(16), true).discordText).toContain('- **Accessible:** No (Reef)\n- **Depth:** n/a');
    expect(fishingZoneShare(byId(998), false).discordText).toContain('charted the **East Shire** fishing spot.');
  });

  it('escapes Discord markdown in zone names', () => {
    const odd = { ...byId(49), name: 'Kraken_Cove *deep*' };
    expect(fishingZoneShare(odd, true).discordText).toContain('**Kraken\\_Cove \\*deep\\***');
  });

  it('stays under the Discord limit for every zone', () => {
    for (const room of rooms) {
      for (const zone of room.zones) {
        expect(fishingZoneShare(zone, !room.isSolo).discordText.length).toBeLessThanOrEqual(DISCORD_MAX);
      }
    }
  });
});

describe('fishing image', () => {
  it('is the zone card: name with the depth circle, then the same rows', () => {
    const zone = byId(49);
    const card = fishingZoneShare(zone, true).card;
    expect(card.title).toBe('ESSI · Fishing zone');
    expect(card.subtitle).toBe('Rankle River');
    expect(card.blocks[0]).toEqual({
      kind: 'hero',
      emoji: '🎣',
      title: "Marooner's Mooring",
      caption: 'Zone 49',
      dot: '#E07AA8',
    });
    expect(card.blocks[2]).toEqual({ kind: 'panel', items: [{ kind: 'facts', rows: zoneFactRows(zone) }] });
    // No depth (a reef): no circle, as on the card.
    expect(fishingZoneShare(byId(16), true).card.blocks[0]).not.toHaveProperty('dot');
    expect(fishingZoneShare(byId(998), false).card.blocks[0]).toMatchObject({ caption: 'Single zone' });
  });
});
