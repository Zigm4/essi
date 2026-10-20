import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCORD_MAX } from '../shared/shareActions';
import { analyze, isValidId, type AsteroidTables } from './asteroidDecoder';
import { characteristicRows, characteristicText, resourceRows } from './asteroidFacts';
import { asteroidIdFromSearch, asteroidRoute, asteroidShare } from './asteroidShare';

const tables = JSON.parse(
  // jsdom environment (appLink reads window.location): read the real data by path.
  readFileSync(resolve(process.cwd(), 'public/catalog/asteroid_tables.json'), 'utf-8'),
) as AsteroidTables;

/** The query of an app link (`…/#/tools/asteroid?id=…`). */
function linkSearch(link: string): string {
  return link.slice(link.indexOf('?'));
}

describe('asteroid links', () => {
  it('round-trips the ID', () => {
    expect(asteroidRoute('195016321')).toBe('/tools/asteroid?id=195016321');
    const share = asteroidShare(analyze('195016321', tables));
    expect(share.link).toContain('#/tools/asteroid?id=195016321');
    expect(asteroidIdFromSearch(linkSearch(share.link))).toBe('195016321');
  });

  it('cleans a pasted ID and keeps a short one for the checklist', () => {
    expect(asteroidIdFromSearch('?id=%23195%20016%20321')).toBe('195016321');
    expect(asteroidIdFromSearch('?id=19501')).toBe('19501');
    expect(asteroidIdFromSearch('?id=abc')).toBeNull();
    expect(asteroidIdFromSearch('?q=195016321')).toBeNull();
    expect(asteroidIdFromSearch('')).toBeNull();
  });
});

describe('asteroidShare', () => {
  it('writes an assay with the value first, the characteristics and the resources', () => {
    const share = asteroidShare(analyze('195016321', tables));
    const text = share.discordText;
    expect(text.startsWith('### ⛏️ ESSI · Asteroid assay\n-# Asteroid Analysis Division · Asteroid 195016321')).toBe(
      true,
    );
    expect(text).toContain('decoded asteroid **195016321**: resource value **20**, wealth **1/9**.');
    expect(text).toContain('- **Size:** ⬛ Hypermassive · ×5');
    expect(text).toContain('- **Structure:** 🏠 Shelter · risk 3');
    expect(text).toContain('- **Salvage:** ❌ No salvage · value 0');
    expect(text).toContain('- 🎈 Helium (He) · 2 pts');
    expect(text).toContain('🏗 This asteroid has significant infrastructure.');
    expect(text).toContain(`[Open this assay in ESSI](<${share.link}>)`);
    expect(text.endsWith('Mining Assay Office, East Shire Space Industries (ESSI)')).toBe(true);
    expect(share.caption).toBe('⛏️ ESSI asteroid assay · 195016321\nResource value 20 · wealth 1/9 · Hypermassive · Manned ship');
    expect(share.fileName).toBe('essi-asteroid-195016321.png');
  });

  it('lists every alert', () => {
    const text = asteroidShare(analyze('195050669', tables)).discordText;
    expect(text).toContain('💎 Rare gas deposits detected!');
    expect(text).toContain('⚠ Star-Tar deposits detected! Estimated harvest rate: 2-5');
    expect(text).toContain('⚔ Combat enabled zone, proceed with caution.');
  });

  it('escapes Discord markdown in catalog names', () => {
    const odd: AsteroidTables = { ...tables, law: { ...tables.law, '6': { name: 'Drone_net *beta*', emoji: '🤖' } } };
    expect(asteroidShare(analyze('195016321', odd)).discordText).toContain('- **Law:** 🤖 Drone\\_net \\*beta\\*');
  });

  it('stays under the Discord limit for every size, structure, salvage, law and resource', () => {
    for (const a of '123456789') {
      for (const b of '0123456789') {
        for (const c of '0123456789') {
          const id = `1${a}${b}${c}9${c}${a}9${a}`;
          if (!isValidId(id)) continue;
          expect(asteroidShare(analyze(id, tables)).discordText.length, id).toBeLessThanOrEqual(DISCORD_MAX);
        }
      }
    }
  });
});

describe('asteroid image', () => {
  it('is the report on screen: alerts, wealth, the same characteristic and resource rows', () => {
    const report = analyze('195050669', tables);
    const card = asteroidShare(report).card;
    expect(card.title).toBe('ESSI · Asteroid analysis');
    expect(card.subtitle).toBe('> asteroid 195050669 · match found ✓');
    const panels = card.blocks.filter((b) => b.kind === 'panel');
    expect(panels).toHaveLength(report.alerts.length + 3);
    // Alerts keep their level's colour.
    expect(panels.slice(0, 4).map((p) => p.tint)).toEqual(['#4FC3FF', '#FFB347', '#FF5577', '#FFB347']);
    const [wealth, characteristics, resources] = panels.slice(4);
    const facts = (p: (typeof panels)[number], i: number) => {
      const item = p.items[i]!;
      return item.kind === 'facts' ? item.rows : [];
    };
    expect(facts(wealth!, 0)).toEqual([
      { label: 'Wealth', value: '●●●●●○○○○  5/9', color: '#FFB347' },
      { label: 'Resource value', value: '275', color: '#7AE3FF' },
    ]);
    expect(characteristics!.items[0]).toEqual({ kind: 'heading', text: 'PRIMARY CHARACTERISTICS' });
    expect(facts(characteristics!, 1)).toEqual(
      characteristicRows(report).map((r) => ({ label: r.label, value: characteristicText(r) })),
    );
    expect(facts(resources!, 1).map((r) => r.label)).toEqual(resourceRows(report).map((r) => r.symbol));
    expect(facts(resources!, 1)[2]!.value).toBe('💎 RareGas · 5 pts');
  });
});
