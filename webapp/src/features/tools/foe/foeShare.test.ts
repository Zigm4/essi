import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCORD_MAX } from '../shared/shareActions';
import { analyze, type FoeTables } from './foeDecoder';
import { foeRowText, foeSections, LOOT_HINT } from './foeFacts';
import { foeIdFromSearch, foeRoute, foeShare } from './foeShare';

const tables = JSON.parse(
  // jsdom environment (appLink reads window.location): read the real data by path.
  readFileSync(resolve(process.cwd(), 'public/catalog/foe_tables.json'), 'utf-8'),
) as FoeTables;

/** The query of an app link (`…/#/tools/foe?id=…`). */
function linkSearch(link: string): string {
  return link.slice(link.indexOf('?'));
}

describe('bounty links', () => {
  it('round-trips the ID', () => {
    expect(foeRoute('3241501042')).toBe('/tools/foe?id=3241501042');
    const share = foeShare(analyze('3241501042', tables));
    expect(share.link).toContain('#/tools/foe?id=3241501042');
    expect(foeIdFromSearch(linkSearch(share.link))).toBe('3241501042');
  });

  it('cleans a pasted ID and keeps a short one for the checklist', () => {
    expect(foeIdFromSearch('?id=FOE%20%233241501042')).toBe('3241501042');
    expect(foeIdFromSearch('?id=3241')).toBe('3241');
    expect(foeIdFromSearch('?id=')).toBeNull();
    expect(foeIdFromSearch('?zone=1')).toBeNull();
  });
});

describe('foeShare', () => {
  it('writes a dossier: faction first, identity, combat profile and reward', () => {
    const share = foeShare(analyze('3241501042', tables));
    const text = share.discordText;
    expect(text.startsWith('### 🎯 ESSI · Bounty dossier\n-# Bounty Registry Division · FOE 3241501042')).toBe(true);
    expect(text).toContain('a registry match on FOE **3241501042**: a 🐺 **Lycanox** (LYC) target.');
    expect(text).toContain('- **Subfaction:** *pending decode*');
    expect(text).toContain('- **Rank:** Sheriff');
    expect(text).toContain('- **Dodge:** 1');
    expect(text).toContain('- **Weapon:** Gatling gun · Range 6');
    expect(text).toContain('- **Protection:** 0');
    expect(text).toContain('- **Best drop:** 🪙 100c');
    expect(text).toContain('-# Loot is RNG: the best drop this FOE can give, not a guarantee.');
    expect(text).toContain(`[Open this dossier in ESSI](<${share.link}>)`);
    expect(text.endsWith('Bounty Office, East Shire Space Industries (ESSI)')).toBe(true);
    expect(share.fileName).toBe('essi-bounty-3241501042.png');
  });

  it('names the blueprints a faction can drop', () => {
    // OUT, loot 2 (Clothing BP), family Bon/er/son.
    const text = foeShare(analyze('6000002000', tables)).discordText;
    expect(text).toContain('- **Family name:** Bonerson');
    expect(text).toContain('- **Possible Outlaws Clothing BP drops:** DUST RAGS BP · BOOT GUARDS BP');
    expect(text).toContain('-# Blueprints are extremely rare');
  });

  it('says when the faction is not identified', () => {
    const share = foeShare(analyze('0000000000', tables));
    expect(share.discordText).toContain('FOE **0000000000**: faction not identified yet.');
    expect(share.discordText).toContain('- **Rank:** *needs faction*');
    expect(share.discordText).toContain('- **Family name:** *needs faction*');
    expect(share.caption).toContain('Faction not identified yet');
  });

  it('shows a partly decoded family name', () => {
    const report = analyze('3000000099', tables); // LYC 0 (Zeb) / 9 (?) / 9 (?)
    expect(foeShare(report).discordText).toContain('- **Family name:** Zeb?? (partly decoded)');
  });

  it('escapes Discord markdown in registry names', () => {
    const odd: FoeTables = { ...tables, faction: { ...tables.faction, '3': { name: 'Lyc_anox *x*', code: 'LYC', emoji: '🐺' } } };
    expect(foeShare(analyze('3241501042', odd)).discordText).toContain('🐺 **Lyc\\_anox \\*x\\*** (LYC)');
  });

  it('stays under the Discord limit for every faction and loot', () => {
    for (const faction of '0123456789') {
      for (const loot of '0123456789') {
        for (const rest of ['000000', '123456', '999999']) {
          const id = `${faction}${rest.slice(0, 5)}${loot}${rest.slice(3)}`;
          expect(foeShare(analyze(id, tables)).discordText.length, id).toBeLessThanOrEqual(DISCORD_MAX);
        }
      }
    }
  });
});

describe('bounty image', () => {
  it('is the decoding on screen: headline, the same rows, the reward', () => {
    const report = analyze('6000002000', tables);
    const card = foeShare(report).card;
    expect(card.title).toBe('ESSI · Bounty decoder');
    expect(card.subtitle).toBe('> bounty 6000002000 · registry match ✓');
    expect(card.blocks[0]).toEqual({ kind: 'hero', emoji: '🏴', title: 'Outlaws', caption: 'FOE 6000002000 · OUT' });
    const panels = card.blocks.filter((b) => b.kind === 'panel');
    expect(panels).toHaveLength(3);
    const sections = foeSections(report);
    const [identity, combat, reward] = panels;
    expect(identity!.items[0]).toEqual({ kind: 'heading', text: 'IDENTITY' });
    const rows = (item: (typeof panels)[number]['items'][number] | undefined) => (item?.kind === 'facts' ? item.rows : []);
    expect(rows(identity!.items[1]).map((r) => r.value)).toEqual(sections.identity.map(foeRowText));
    expect(rows(combat!.items[1])).toEqual([
      { label: 'Rank', value: 'Scavenger' },
      { label: 'Dodge', value: '0', color: '#7AE3FF' },
      { label: 'Weapon', value: 'RUSTY BLADE · Range 0' },
      { label: 'Protection', value: '0', color: '#7AE3FF' },
    ]);
    expect(reward!.items.map((i) => i.kind)).toEqual(['heading', 'facts', 'rich', 'rich', 'rich', 'rich']);
    expect(reward!.items[2]).toEqual({ kind: 'rich', text: LOOT_HINT, maxLines: 4, color: '#8AA4C2' });
  });

  it('dims pending rows', () => {
    const card = foeShare(analyze('0000000000', tables)).card;
    expect(card.blocks[0]).toMatchObject({ emoji: '❔', title: 'Unknown faction', caption: 'FOE 0000000000' });
    const identity = card.blocks.find((b) => b.kind === 'panel');
    const facts = identity?.kind === 'panel' ? identity.items[1] : undefined;
    expect(facts?.kind === 'facts' ? facts.rows[0] : null).toEqual({
      label: 'Subfaction',
      value: 'needs faction',
      color: '#6E8AAB',
    });
  });
});
