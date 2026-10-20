import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCORD_MAX } from '../shared/shareActions';
import { capResults, parseWallets, search, type WalletOwner } from './walletData';
import { walletQueryFromSearch, walletRoute, walletShare } from './walletShare';

const owners = parseWallets(
  JSON.parse(
    // jsdom environment (appLink reads window.location): read the real data by path.
    readFileSync(resolve(process.cwd(), 'public/catalog/wallets.json'), 'utf-8'),
  ) as unknown,
);

const SAMPLE: WalletOwner[] = [
  { display_name: 'Alice', discord_username: 'alice_1', wallets: ['aaaaa.wam', 'zzzzz.wam'] },
  { display_name: 'Bob', discord_username: 'bob', wallets: ['bbbbb.wam'] },
  { display_name: 'Carol*', discord_username: null, wallets: ['aaaaa2.wam'] },
];

const lookup = (query: string, list: WalletOwner[] = SAMPLE) => walletShare(query, capResults(search(query, list)));

/** The query of an app link (`…/#/tools/wallet?q=…`). */
function linkSearch(link: string): string {
  return link.slice(link.indexOf('?'));
}

describe('wallet links', () => {
  it('round-trips the query', () => {
    expect(walletRoute(' alice ')).toBe('/tools/wallet?q=alice');
    for (const q of ['alice', '@bob', 'a b&c=d', 'zzzzz.wam']) {
      const share = lookup(q);
      expect(share.link).toContain('#/tools/wallet?q=');
      expect(walletQueryFromSearch(linkSearch(share.link))).toBe(q);
    }
    expect(walletQueryFromSearch('')).toBe('');
  });
});

describe('walletShare', () => {
  it('writes a registry extract: owners with their wallets, then wallet matches', () => {
    const share = lookup('aaaaa');
    const text = share.discordText;
    expect(text.startsWith('### 👛 ESSI · Wallet registry\n-# Asset Registry Office · Blockchain analysis')).toBe(true);
    expect(text).toContain('The Asset Registry Office returns **2 results** for “aaaaa”.');
    expect(text).toContain('- 👛 `aaaaa.wam` → registered to **Alice** (@alice\\_1)');
    expect(text).toContain('- 👛 `aaaaa2.wam` → registered to **Carol\\***');
    expect(text).toContain(`[Open this lookup in ESSI](<${share.link}>)`);
    expect(text.endsWith('Asset Registry Office, East Shire Space Industries (ESSI)')).toBe(true);

    const owner = lookup('alice').discordText;
    expect(owner).toContain('returns **1 result** for “alice”.');
    expect(owner).toContain('- 👤 **Alice** · @alice\\_1 · `aaaaa.wam`, `zzzzz.wam`');
    // A handle equal to the name isn't repeated (same rule as the results).
    expect(lookup('bob').discordText).toContain('- 👤 **Bob** · `bbbbb.wam`\n');
  });

  it('escapes the query and never pings', () => {
    const text = lookup('@here *x*').discordText;
    expect(text).toContain('for “@​here \\*x\\*”');
    expect(text).not.toMatch(/@here/);
  });

  it('fits a long result list under the Discord limit with the rest counted', () => {
    const share = lookup('wam', owners);
    expect(share.discordText.length).toBeLessThanOrEqual(DISCORD_MAX);
    expect(share.discordText).toMatch(/- …and \d+ more in ESSI/);
    // The card: 6 owner cards at most, then wallet matches, then the count of the rest.
    const panels = share.card.blocks.filter((b) => b.kind === 'panel');
    expect(panels.length).toBeLessThanOrEqual(14);
    expect(share.card.blocks.at(-1)).toMatchObject({ kind: 'caption' });
    expect((share.card.blocks.at(-1) as { text: string }).text).toMatch(/^\+\d+ more$/);
  });
});

describe('wallet image', () => {
  it('draws owner cards and wallet matches like the results', () => {
    const card = lookup('a').card;
    expect(card.title).toBe('ESSI · Wallet lookup');
    expect(card.subtitle).toBe('Query: “a” · 3 results');
    expect(card.blocks[0]).toEqual({
      kind: 'panel',
      items: [
        {
          kind: 'facts',
          rows: [
            { label: 'Owner', value: 'Alice' },
            { label: 'Discord', value: '@alice_1', color: '#7AE3FF' },
            { label: '2 wallets', value: 'aaaaa.wam' },
            { label: '', value: 'zzzzz.wam' },
          ],
        },
      ],
    });
    // "a" matches Alice's and Carol's names (owner cards) and Bob's "….wam" (a wallet match).
    expect(card.blocks.map((b) => b.kind)).toEqual(['panel', 'panel', 'caption', 'panel']);

    const hits = lookup('aaaaa2').card;
    expect(hits.blocks[0]).toEqual({ kind: 'caption', text: 'WALLET MATCHES', color: '#4FC3FF' });
    expect(hits.blocks[1]).toEqual({
      kind: 'panel',
      items: [
        {
          kind: 'facts',
          rows: [
            { label: 'Wallet', value: 'aaaaa2.wam' },
            { label: 'Registered to', value: 'Carol*', color: '#4FC3FF' },
          ],
        },
      ],
    });
  });
});
