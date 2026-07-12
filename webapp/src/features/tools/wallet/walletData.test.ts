// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  capResults,
  parseWallets,
  search,
  walletStats,
  type WalletOwner,
} from './walletData';

const owners = parseWallets(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../public/catalog/wallets.json', import.meta.url)),
      'utf-8',
    ),
  ),
);

const SAMPLE: WalletOwner[] = [
  { display_name: 'Alice', discord_username: 'alice#1', wallets: ['aaaaa.wam', 'zzzzz.wam'] },
  { display_name: 'Bob', discord_username: 'bobby', wallets: ['bbbbb.wam'] },
  { display_name: 'Carol', discord_username: null, wallets: ['aaaaa2.wam'] },
];

describe('parseWallets', () => {
  it('loads all 769 owners and 785 wallets from the shipped file', () => {
    expect(owners.length).toBe(769);
    expect(walletStats(owners).totalWallets).toBe(785);
  });

  it('defaults a missing wallets array to []', () => {
    const parsed = parseWallets([{ display_name: 'X', discord_username: 'x' }]);
    expect(parsed[0]?.wallets).toEqual([]);
  });
});

describe('search', () => {
  it('returns nothing for a blank query', () => {
    expect(search('   ', SAMPLE)).toEqual({ ownerHits: [], walletHits: [] });
  });

  it('matches owners by display name and discord handle (case-insensitive)', () => {
    expect(search('ALICE', SAMPLE).ownerHits.map((o) => o.display_name)).toEqual(['Alice']);
    expect(search('bobby', SAMPLE).ownerHits.map((o) => o.display_name)).toEqual(['Bob']);
  });

  it('matches wallets and dedupes hits whose owner is already an owner hit', () => {
    // "aaaaa" matches Alice's wallet AND Carol's wallet. Also query hits no owner
    // names, so both remain wallet hits.
    const r = search('aaaaa', SAMPLE);
    expect(r.ownerHits).toHaveLength(0);
    expect(r.walletHits.map((h) => h.wallet)).toEqual(['aaaaa.wam', 'aaaaa2.wam']);
  });

  it('removes a wallet hit when its owner already appears as an owner hit', () => {
    // "a" matches owner "Alice" AND "Carol" by name? "Carol" has no 'a'... "Alice"
    // and wallet strings. Use a query that hits both an owner name and its wallet.
    const owner: WalletOwner = {
      display_name: 'wamboss',
      discord_username: 'wamboss',
      wallets: ['wam12.wam'],
    };
    const r = search('wam', [owner]);
    expect(r.ownerHits).toHaveLength(1);
    // the wallet hit for the same owner is removed by dedup
    expect(r.walletHits).toHaveLength(0);
  });
});

describe('walletStats', () => {
  it('computes the average per owner to one decimal', () => {
    expect(walletStats(SAMPLE).avgPerOwner).toBe('1.3'); // 4 wallets / 3 owners
    expect(walletStats(owners).avgPerOwner).toBe('1.0'); // 785 / 769
  });
});

describe('capResults', () => {
  it('caps at 50 items, owners first, and reports the hidden count', () => {
    const ownerHits: WalletOwner[] = Array.from({ length: 60 }, (_, i) => ({
      display_name: `o${i}`,
      discord_username: `o${i}`,
      wallets: [],
    }));
    const walletHits = Array.from({ length: 5 }, (_, i) => ({
      wallet: `w${i}`,
      owner: ownerHits[0]!,
    }));
    const display = capResults({ ownerHits, walletHits });
    expect(display.owners).toHaveLength(50);
    expect(display.walletHits).toHaveLength(0);
    expect(display.total).toBe(65);
    expect(display.shown).toBe(50);
    expect(display.hiddenCaption).toBe(
      'Showing 50 of 65 matches - refine your search to narrow down.',
    );
  });
});
