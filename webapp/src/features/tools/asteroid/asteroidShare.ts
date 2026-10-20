/**
 * Share content for the Asteroid Analyzer, in the same three forms as the
 * NASA tools and Jobs: a Discord message (an ESSI "transmission"), a PNG card
 * and a link.
 *
 * The link (`/tools/asteroid?id=<9 digits>`) fills the ID and shows the
 * analysis again: the ID is the whole result, so nothing else travels.
 */

import { cleanIdInput } from '../shared/idInput';
import { appLink, escapeDiscord, type ShareContent } from '../shared/shareActions';
import type { CardBlock, CardSpec } from '../shared/shareCard';
import { transmission } from '../shared/transmission';
import {
  alertRows,
  characteristicRows,
  characteristicText,
  resourceRows,
  WEALTH_MAX,
  wealthText,
  type ResourceRow,
} from './asteroidFacts';
import type { AsteroidReport } from './asteroidDecoder';

const SITE = 'zigm4.github.io/essi';
const SIGN_OFF = 'Mining Assay Office, East Shire Space Industries (ESSI)';
const ACCENT_SECONDARY = '#7AE3FF';
const ACCENT_WARN = '#FFB347';

/** The link that reopens one analysis. */
export function asteroidRoute(id: string): string {
  return `/tools/asteroid?id=${encodeURIComponent(id)}`;
}

/**
 * The asteroid ID a link opens (`?id=`), cleaned like a paste (at most 9
 * digits), or null. An ID that fails the format rules still fills the field,
 * so the checklist says what is wrong with it.
 */
export function asteroidIdFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('id');
  if (raw === null) return null;
  const id = cleanIdInput(raw, 9);
  return id.length > 0 ? id : null;
}

/** `💧 Hydrogen (H2) · 1 pts`. */
function resourceText(r: ResourceRow): string {
  return `${r.emoji} ${r.name}${r.symbol === undefined ? '' : ` (${r.symbol})`} · ${r.points}`;
}

/** The screen's row of coins as text: `●●○○○○○○○ 2/9`. */
function wealthMeter(report: AsteroidReport): string {
  const on = Math.max(0, Math.min(WEALTH_MAX, report.wealth));
  return `${'●'.repeat(on)}${'○'.repeat(WEALTH_MAX - on)}  ${wealthText(report)}`;
}

export function asteroidShare(report: AsteroidReport): ShareContent {
  const link = appLink(asteroidRoute(report.id));
  const alerts = alertRows(report);
  const characteristics = characteristicRows(report);
  const resources = resourceRows(report);

  const discordText = transmission({
    header: '⛏️ ESSI · Asteroid assay',
    division: `Asteroid Analysis Division · Asteroid ${report.id}`,
    intro: `Our assayers have decoded asteroid **${report.id}**: resource value **${report.resourceValueText}**, wealth **${wealthText(report)}**.`,
    body: [
      '**Primary characteristics**',
      ...characteristics.map((r) => `- **${r.label}:** ${escapeDiscord(characteristicText(r))}`),
      '',
      '**Resources**',
      ...resources.map((r) => `- ${escapeDiscord(resourceText(r))}`),
    ],
    after: alerts.map((a) => `${a.emoji} ${escapeDiscord(a.message)}`),
    linkLabel: 'Open this assay in ESSI',
    link,
    signOff: SIGN_OFF,
  });

  // The image is the report on screen: alerts, wealth, characteristics, resources.
  const blocks: CardBlock[] = [
    ...alerts.map(
      (a): CardBlock => ({ kind: 'panel', tint: a.tint, items: [{ kind: 'rich', text: `${a.emoji} ${a.message}` }] }),
    ),
    {
      kind: 'panel',
      items: [
        {
          kind: 'facts',
          rows: [
            { label: 'Wealth', value: wealthMeter(report), color: ACCENT_WARN },
            { label: 'Resource value', value: report.resourceValueText, color: ACCENT_SECONDARY },
          ],
        },
      ],
    },
    {
      kind: 'panel',
      items: [
        { kind: 'heading', text: 'PRIMARY CHARACTERISTICS' },
        { kind: 'facts', rows: characteristics.map((r) => ({ label: r.label, value: characteristicText(r) })) },
      ],
    },
    {
      kind: 'panel',
      items: [
        { kind: 'heading', text: 'RESOURCES' },
        {
          kind: 'facts',
          rows: resources.map((r) => ({ label: r.symbol ?? r.name, value: `${r.emoji} ${r.name} · ${r.points}` })),
        },
      ],
    },
  ];
  const card: CardSpec = {
    title: 'ESSI · Asteroid analysis',
    subtitle: `> asteroid ${report.id} · match found ✓`,
    blocks,
    footer: `ESSI · Asteroid Analysis Division · ${SITE}`,
  };

  return {
    title: `ESSI asteroid assay: ${report.id}`,
    caption: `⛏️ ESSI asteroid assay · ${report.id}\nResource value ${report.resourceValueText} · wealth ${wealthText(
      report,
    )} · ${report.size.name} · ${report.law.name}`,
    discordText,
    link,
    card,
    fileName: `essi-asteroid-${report.id}.png`,
  };
}
