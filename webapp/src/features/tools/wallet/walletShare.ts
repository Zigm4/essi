/**
 * Share content for Wallet Lookup, in the same three forms as the NASA tools
 * and Jobs: a Discord message (an ESSI "transmission"), a PNG card and a link.
 *
 * The link (`/tools/wallet?q=<query>`) runs the same search again: the query
 * is all that travels (the tool already reads `?q=`, like the global search).
 * Message and card show what the results show: names, handles and wallets.
 */

import { appLink, DISCORD_MAX, escapeDiscord, type ShareContent } from '../shared/shareActions';
import type { CardBlock, CardSpec, FactRowSpec } from '../shared/shareCard';
import { transmission } from '../shared/transmission';
import {
  ownerHandle,
  resultsLabel,
  walletCountLabel,
  type WalletDisplay,
  type WalletHit,
  type WalletOwner,
} from './walletData';

const SITE = 'zigm4.github.io/essi';
const SIGN_OFF = 'Asset Registry Office, East Shire Space Industries (ESSI)';
const ACCENT_PRIMARY = '#4FC3FF';
const ACCENT_SECONDARY = '#7AE3FF';
const CARD_OWNERS_MAX = 6;
const CARD_HITS_MAX = 8;
const LIST_DISCORD_MAX = 15;

/** The link that runs a search again. */
export function walletRoute(query: string): string {
  return `/tools/wallet?q=${encodeURIComponent(query.trim())}`;
}

/** The search a link opens (`?q=`), or '' (the overview). */
export function walletQueryFromSearch(search: string): string {
  return new URLSearchParams(search).get('q') ?? '';
}

/** Escaped for Discord, and `@everyone` / `@here` can't ping anyone. */
function safe(text: string): string {
  return escapeDiscord(text).replace(/@(everyone|here)/gi, '@​$1');
}

/** A wallet as inline code (WAX names never hold a backtick; just in case). */
function code(wallet: string): string {
  return `\`${wallet.replace(/`/g, "'")}\``;
}

function ownerLine(owner: WalletOwner): string {
  const handle = ownerHandle(owner);
  return [
    `👤 **${safe(owner.display_name)}**`,
    ...(handle === null ? [] : [safe(handle)]),
    owner.wallets.length === 0 ? 'no wallet' : owner.wallets.map(code).join(', '),
  ].join(' · ');
}

function hitLine(hit: WalletHit): string {
  const handle = ownerHandle(hit.owner);
  return `👛 ${code(hit.wallet)} → registered to **${safe(hit.owner.display_name)}**${
    handle === null ? '' : ` (${safe(handle)})`
  }`;
}

function ownerPanel(owner: WalletOwner): CardBlock {
  const handle = ownerHandle(owner);
  const rows: FactRowSpec[] = [
    { label: 'Owner', value: owner.display_name },
    ...(handle === null ? [] : [{ label: 'Discord', value: handle, color: ACCENT_SECONDARY }]),
    // The count labels the first wallet, like the card's "2 wallets".
    ...owner.wallets.map((w, i) => ({ label: i === 0 ? walletCountLabel(owner.wallets.length) : '', value: w })),
  ];
  return { kind: 'panel', items: [{ kind: 'facts', rows }] };
}

function hitPanel(hit: WalletHit): CardBlock {
  const handle = ownerHandle(hit.owner);
  return {
    kind: 'panel',
    items: [
      {
        kind: 'facts',
        rows: [
          { label: 'Wallet', value: hit.wallet },
          {
            label: 'Registered to',
            value: `${hit.owner.display_name}${handle === null ? '' : ` (${handle})`}`,
            color: ACCENT_PRIMARY,
          },
        ],
      },
    ],
  };
}

/**
 * @param query the search as typed
 * @param display the results on screen (owners first, then wallet matches)
 */
export function walletShare(query: string, display: WalletDisplay): ShareContent {
  const q = query.trim();
  const link = appLink(walletRoute(q));
  const total = display.total;
  const count = resultsLabel(total);
  const lines = [...display.owners.map(ownerLine), ...display.walletHits.map(hitLine)];

  const discordFor = (shown: number): string => {
    const hidden = total - shown;
    return transmission({
      header: '👛 ESSI · Wallet registry',
      division: 'Asset Registry Office · Blockchain analysis',
      intro: `The Asset Registry Office returns **${count}** for “${safe(q)}”.`,
      body:
        lines.length === 0
          ? ['No owner or wallet matches this search.']
          : [
              '**Registry extract**',
              ...lines.slice(0, shown).map((l) => `- ${l}`),
              ...(hidden > 0 ? [`- …and ${hidden} more in ESSI`] : []),
            ],
      linkLabel: 'Open this lookup in ESSI',
      link,
      signOff: SIGN_OFF,
    });
  };
  // As many matches as Discord's message limit allows.
  let shown = Math.min(lines.length, LIST_DISCORD_MAX);
  let discordText = discordFor(shown);
  while (discordText.length > DISCORD_MAX && shown > 1) {
    shown -= 1;
    discordText = discordFor(shown);
  }

  // The image is the results on screen: owner cards, then the wallet matches.
  const owners = display.owners.slice(0, CARD_OWNERS_MAX);
  const hits = display.walletHits.slice(0, CARD_HITS_MAX + (CARD_OWNERS_MAX - owners.length));
  const blocks: CardBlock[] = owners.map(ownerPanel);
  if (hits.length > 0) {
    blocks.push({ kind: 'caption', text: 'WALLET MATCHES', color: ACCENT_PRIMARY }, ...hits.map(hitPanel));
  }
  if (total === 0) blocks.push({ kind: 'caption', text: 'No matches.' });
  const cardHidden = total - owners.length - hits.length;
  if (cardHidden > 0) blocks.push({ kind: 'caption', text: `+${cardHidden} more` });
  const card: CardSpec = {
    title: 'ESSI · Wallet lookup',
    subtitle: `Query: “${q}” · ${count}`,
    blocks,
    footer: `ESSI · Asset Registry Office · ${SITE}`,
  };

  return {
    title: 'ESSI wallet registry',
    caption: `👛 ESSI wallet registry · ${count} for “${q}”`,
    discordText,
    link,
    card,
    fileName: `essi-wallet-${q.replace(/[^A-Za-z0-9.]+/g, '-').slice(0, 40) || 'lookup'}.png`,
  };
}
