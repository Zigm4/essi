/**
 * Share content for the Bounty Decoder, in the same three forms as the NASA
 * tools and Jobs: a Discord message (an ESSI "transmission"), a PNG card and
 * a link.
 *
 * The link (`/tools/foe?id=<10 digits>`) fills the ID and shows the decoding
 * again: the ID is the whole result, so nothing else travels.
 */

import { cleanIdInput } from '../shared/idInput';
import { appLink, escapeDiscord, type ShareContent } from '../shared/shareActions';
import type { CardBlock, CardSpec, FactRowSpec, PanelItem } from '../shared/shareCard';
import { transmission } from '../shared/transmission';
import type { FoeReport } from './foeDecoder';
import {
  BLUEPRINT_HINT,
  foeHeadline,
  foeLootPool,
  foeRowText,
  foeSections,
  isBlueprintReward,
  isPartialFamily,
  LOOT_HINT,
  type FoeRow,
} from './foeFacts';

const SITE = 'zigm4.github.io/essi';
const SIGN_OFF = 'Bounty Office, East Shire Space Industries (ESSI)';
const ACCENT_SECONDARY = '#7AE3FF';
const TEXT_SECONDARY = '#8AA4C2';
const TEXT_DIM = '#6E8AAB';

/** The link that reopens one decoding. */
export function foeRoute(id: string): string {
  return `/tools/foe?id=${encodeURIComponent(id)}`;
}

/**
 * The FOE ID a link opens (`?id=`), cleaned like a paste (at most 10 digits),
 * or null. A short ID still fills the field, so the checklist says what is
 * missing.
 */
export function foeIdFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('id');
  if (raw === null) return null;
  const id = cleanIdInput(raw, 10);
  return id.length > 0 ? id : null;
}

/** A row for Discord: pending values in italics. */
function discordRow(row: FoeRow): string {
  const text = escapeDiscord(foeRowText(row));
  const pending = row.value === null && !isPartialFamily(row);
  return `- **${row.label}:** ${pending ? `*${text}*` : text}`;
}

/** A row for the card: like the screen, raw values in the accent, pending ones dimmed. */
function cardRow(row: FoeRow): FactRowSpec {
  const color = row.isValue
    ? ACCENT_SECONDARY
    : row.value === null && !isPartialFamily(row)
      ? TEXT_DIM
      : undefined;
  return { label: row.label, value: foeRowText(row), ...(color !== undefined ? { color } : {}) };
}

export function foeShare(report: FoeReport): ShareContent {
  const link = appLink(foeRoute(report.id));
  const headline = foeHeadline(report);
  const sections = foeSections(report);
  const pool = foeLootPool(report);
  const blueprint = isBlueprintReward(report);
  const faction = headline.known
    ? `${headline.emoji === '' ? '' : `${headline.emoji} `}**${escapeDiscord(headline.name)}**${
        headline.code === undefined ? '' : ` (${headline.code})`
      }`
    : null;

  const discordText = transmission({
    header: '🎯 ESSI · Bounty dossier',
    division: `Bounty Registry Division · FOE ${report.id}`,
    intro:
      faction === null
        ? `The Bounty Office has a registry match on FOE **${report.id}**: faction not identified yet.`
        : `The Bounty Office has a registry match on FOE **${report.id}**: a ${faction} target.`,
    body: [
      '**Identity**',
      ...sections.identity.map(discordRow),
      '',
      '**Combat profile**',
      ...sections.combat.map(discordRow),
      '',
      '**Reward**',
      discordRow({ ...sections.loot, label: 'Best drop' }),
      ...(pool === null ? [] : [`- **${escapeDiscord(pool.label)}:** ${pool.items.map(escapeDiscord).join(' · ')}`]),
    ],
    after: [
      '-# Loot is RNG: the best drop this FOE can give, not a guarantee.',
      ...(blueprint ? ['-# Blueprints are extremely rare: once you own one, you can craft as many as you can afford.'] : []),
    ],
    linkLabel: 'Open this dossier in ESSI',
    link,
    signOff: SIGN_OFF,
  });

  // The image is the decoding on screen: headline, Identity, Combat profile, Reward.
  const reward: PanelItem[] = [
    { kind: 'heading', text: 'REWARD' },
    { kind: 'facts', rows: [cardRow(sections.loot)] },
    { kind: 'rich', text: LOOT_HINT, maxLines: 4, color: TEXT_SECONDARY },
  ];
  if (pool !== null) {
    reward.push(
      { kind: 'rich', text: pool.label, color: TEXT_SECONDARY },
      // The screen's chips: an item never breaks across lines.
      { kind: 'rich', text: pool.items.map((i) => i.replace(/ /g, '\u00A0')).join(' · '), maxLines: 6 },
    );
  }
  if (blueprint) reward.push({ kind: 'rich', text: BLUEPRINT_HINT, maxLines: 3, color: TEXT_SECONDARY });
  const blocks: CardBlock[] = [
    {
      kind: 'hero',
      emoji: headline.emoji === '' ? '❔' : headline.emoji,
      title: headline.name,
      caption: `FOE ${report.id}${headline.code === undefined ? '' : ` · ${headline.code}`}`,
    },
    { kind: 'space', height: 8 },
    {
      kind: 'panel',
      items: [
        { kind: 'heading', text: 'IDENTITY' },
        { kind: 'facts', rows: sections.identity.map(cardRow) },
      ],
    },
    {
      kind: 'panel',
      items: [
        { kind: 'heading', text: 'COMBAT PROFILE' },
        { kind: 'facts', rows: sections.combat.map(cardRow) },
      ],
    },
    { kind: 'panel', items: reward },
  ];
  const card: CardSpec = {
    title: 'ESSI · Bounty decoder',
    subtitle: `> bounty ${report.id} · registry match ✓`,
    blocks,
    footer: `ESSI · Bounty Registry Division · ${SITE}`,
  };

  const loot = foeRowText(sections.loot);
  return {
    title: `ESSI bounty dossier: FOE ${report.id}`,
    caption: `🎯 ESSI bounty dossier · FOE ${report.id}\n${headline.known ? headline.name : 'Faction not identified yet'} · best drop ${loot}`,
    discordText,
    link,
    card,
    fileName: `essi-bounty-${report.id}.png`,
  };
}
