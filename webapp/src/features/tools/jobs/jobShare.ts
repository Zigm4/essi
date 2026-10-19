/**
 * Share content for the Jobs tool, in the same three forms as the NASA tools:
 * a Discord message (an ESSI "transmission"), a PNG card and a link.
 *
 * - One job: a "Job briefing". Its link (`/tools/jobs?job=<id>`) opens the
 *   job's sheet without touching the recipient's own filters.
 * - The filtered list: a "Job board" extract. Its link carries the shareable
 *   filters (`jobsUrl`); stars and progress stay the viewer's own.
 */

import { stripMarkdown } from '../shared/markdown';
import { appLink, DISCORD_MAX, escapeDiscord, type ShareContent } from '../shared/shareActions';
import type { CardBlock, CardSpec } from '../shared/shareCard';
import { transmission } from '../shared/transmission';
import { bonusFactText, costText, equipmentText, repText, skillText, trainsText } from './jobFacts';
import { coordsLabel, type Job, type JobLocation } from './jobModel';
import { locationDisplayLabel, locationName } from './jobPlaces';
import type { JobFilter } from './jobsLogic';
import { encodeJobsSearch } from './jobsUrl';
import { factionInfo, rewardInfo, tagLabel } from './jobTaxonomies';

const SITE = 'zigm4.github.io/essi';
const SIGN_OFF = 'Job Allocation Desk, East Shire Space Industries (ESSI)';
const DANGER = '#FF5577';
const DESCRIPTION_MAX = 320;

/** The link that opens one job's sheet. */
export function jobRoute(id: number): string {
  return `/tools/jobs?job=${id}`;
}

/** The job a link opens (`?job=<id>`), or null. */
export function jobIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('job');
  if (raw === null || !/^\d{1,12}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** "Beginner", "Maintenance" - the job's type as a word. */
function typeWord(job: Job): string {
  const t = job.typeRaw.trim();
  return t.length === 0 ? 'Job' : `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

/** "Queens Quarry", or "355 · z112" for an unnamed place. */
function placeName(loc: JobLocation): string {
  return locationName(loc) ?? coordsLabel(loc);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** The requirements a player must meet, worded for a list ("none" when there are none). */
function requirementParts(job: Job): string[] {
  const parts: string[] = [];
  if (job.requiredTag !== null) parts.push(`tag ${tagLabel(job.requiredTag)}`);
  if (job.skillRequirement !== null) parts.push(skillText(job));
  if (job.requiredRep > 0) parts.push(`rep ${repText(job)}`);
  const equipment = equipmentText(job);
  if (equipment !== null) parts.push(equipment);
  const cost = costText(job);
  if (cost !== null) parts.push(`costs ${cost}`);
  return parts;
}

// --- One job -----------------------------------------------------------------

export function jobShare(job: Job): ShareContent {
  const link = appLink(jobRoute(job.id));
  const type = typeWord(job);
  const ally = job.factionRep !== null ? factionInfo(job.factionRep) : null;
  const gains = job.alsoGainsFaction !== null ? factionInfo(job.alsoGainsFaction) : null;
  const harmed = job.harmedFaction !== null ? factionInfo(job.harmedFaction) : null;
  const reward = rewardInfo(job.reward);
  const description = stripMarkdown(job.description);
  const requirements = requirementParts(job);
  const cargo = job.isCargoJob
    ? job.ship !== null
      ? `capacity ${job.capacity} · ship ${job.ship}`
      : `capacity ${job.capacity}`
    : null;

  const intro = [
    `The Job Allocation Desk has posted a ${type.toLowerCase()} job${ally === null ? '' : ` for **${ally.fullLabel}**`}.`,
    ...(description.length > 0 ? [`> ${escapeDiscord(truncate(description, DESCRIPTION_MAX))}`] : []),
  ].join('\n');
  const body = [
    '**Mission parameters**',
    `- **Pickup:** ${locationDisplayLabel(job.pickupLocation)}`,
    `- **Drop-off:** ${locationDisplayLabel(job.dropoffLocation)}`,
    `- **Reward:** ${reward.label} · ${bonusFactText(job.bonus)}`,
    ...(ally !== null ? [`- **Reputation:** + ${ally.fullLabel}`] : []),
    ...(gains !== null ? [`- **Also gains rep:** ${gains.fullLabel}`] : []),
    ...(harmed !== null ? [`- **Loses rep:** ⚠️ ${harmed.fullLabel}`] : []),
    `- **Requirements:** ${requirements.length === 0 ? 'none' : requirements.join(' · ')}`,
    ...(trainsText(job) !== null ? [`- **Trains:** ${trainsText(job)}`] : []),
    `- **Risk:** ${job.risk}`,
    ...(cargo !== null ? [`- **Cargo:** ${cargo}`] : []),
  ];
  const discordText = transmission({
    header: '💼 ESSI · Job briefing',
    division: `Job Allocation Desk · Job #${job.id}`,
    intro,
    body,
    after: [`🆔 In-game job ID: **${job.id}**`],
    linkLabel: 'Open this job in ESSI',
    link,
    signOff: SIGN_OFF,
  });

  const blocks: CardBlock[] = [
    { kind: 'hero', emoji: '💼', title: `Job #${job.id}`, caption: ally?.fullLabel ?? type },
  ];
  if (description.length > 0) {
    blocks.push({ kind: 'space', height: 4 }, { kind: 'paragraph', text: description, maxLines: 5 });
  }
  blocks.push(
    { kind: 'divider', alpha: 0.3 },
    { kind: 'space', height: 4 },
    { kind: 'kv', label: 'Pickup', value: locationDisplayLabel(job.pickupLocation) },
    { kind: 'kv', label: 'Drop-off', value: locationDisplayLabel(job.dropoffLocation) },
    { kind: 'kv', label: 'Reward', value: `${reward.label} · ${bonusFactText(job.bonus)}`, valueColor: reward.tint },
  );
  if (ally !== null) blocks.push({ kind: 'kv', label: 'Reputation', value: `+ ${ally.label}`, valueColor: ally.tint });
  if (gains !== null) blocks.push({ kind: 'kv', label: 'Also gains', value: `+ ${gains.label}`, valueColor: gains.tint });
  if (harmed !== null) blocks.push({ kind: 'kv', label: 'Loses rep', value: harmed.label, valueColor: DANGER });
  if (requirements.length === 0) blocks.push({ kind: 'kv', label: 'Requirements', value: 'none' });
  else {
    if (job.requiredTag !== null) blocks.push({ kind: 'kv', label: 'Tag', value: tagLabel(job.requiredTag) });
    if (job.skillRequirement !== null) blocks.push({ kind: 'kv', label: 'Skill', value: skillText(job) });
    if (job.requiredRep > 0) blocks.push({ kind: 'kv', label: 'Reputation needed', value: repText(job) });
    const equipment = equipmentText(job);
    if (equipment !== null) blocks.push({ kind: 'kv', label: 'Equipment', value: equipment });
    const cost = costText(job);
    if (cost !== null) blocks.push({ kind: 'kv', label: 'Cost', value: cost, valueColor: '#FFB347' });
  }
  const trains = trainsText(job);
  if (trains !== null) blocks.push({ kind: 'kv', label: 'Trains', value: trains, valueColor: '#5FE8A0' });
  blocks.push({ kind: 'kv', label: 'Risk', value: String(job.risk) });
  if (cargo !== null) blocks.push({ kind: 'kv', label: 'Cargo', value: cargo });
  blocks.push({ kind: 'space', height: 6 }, { kind: 'divider' });

  const card: CardSpec = {
    title: 'ESSI · Job briefing',
    pill: type.toUpperCase(),
    blocks,
    footer: `ESSI · Job Allocation Desk · ${SITE}`,
  };
  return {
    title: `ESSI job briefing: #${job.id}`,
    caption: `💼 ESSI job briefing · #${job.id} (${type}${ally === null ? '' : `, ${ally.label}`})\n${placeName(
      job.pickupLocation,
    )} → ${placeName(job.dropoffLocation)} · reward ${reward.label}`,
    discordText,
    link,
    card,
    fileName: `essi-job-${job.id}.png`,
  };
}

// --- The filtered list -------------------------------------------------------

const LIST_DISCORD_MAX = 12;
const LIST_CARD_MAX = 25;

function listLine(job: Job): string {
  const ally = job.factionRep !== null ? factionInfo(job.factionRep).label : null;
  return [
    `**#${job.id}**`,
    typeWord(job),
    ...(ally !== null ? [ally] : []),
    `${placeName(job.pickupLocation)} → ${placeName(job.dropoffLocation)}`,
    rewardInfo(job.reward).label,
  ].join(' · ');
}

/**
 * @param jobs the jobs on screen, in display order
 * @param filterLabels the active filters as the screen words them ("Professor Q", "From: Northshire"…)
 */
export function jobsListShare(jobs: readonly Job[], filter: JobFilter, filterLabels: readonly string[]): ShareContent {
  const link = appLink(`/tools/jobs${encodeJobsSearch(filter)}`);
  const count = `${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
  const criteria = [...filterLabels, ...(filter.query.trim().length > 0 ? [`“${filter.query.trim()}”`] : [])];
  const intro =
    criteria.length === 0
      ? `The Job Allocation Desk lists **${count}** on the board.`
      : `The Job Allocation Desk lists **${count}** matching ${criteria.map((c) => escapeDiscord(c)).join(' · ')}.`;

  const discordFor = (shown: number): string => {
    const hidden = jobs.length - shown;
    return transmission({
      header: '💼 ESSI · Job board',
      division: `Job Allocation Desk · ${count}`,
      intro,
      body:
        jobs.length === 0
          ? ['No job matches these filters right now.']
          : [
              '**Board extract**',
              ...jobs.slice(0, shown).map((j) => `- ${listLine(j)}`),
              ...(hidden > 0 ? [`- …and ${hidden} more in ESSI`] : []),
            ],
      linkLabel: 'Open this board in ESSI',
      link,
      signOff: SIGN_OFF,
    });
  };
  // As many jobs as Discord's message limit allows.
  let shown = Math.min(jobs.length, LIST_DISCORD_MAX);
  let discordText = discordFor(shown);
  while (discordText.length > DISCORD_MAX && shown > 1) {
    shown -= 1;
    discordText = discordFor(shown);
  }

  const blocks: CardBlock[] = [];
  if (criteria.length > 0) blocks.push({ kind: 'paragraph', text: criteria.join(' · '), maxLines: 2, color: '#8AA4C2' });
  if (jobs.length === 0) blocks.push({ kind: 'caption', text: 'No job matches these filters right now.' });
  for (const job of jobs.slice(0, LIST_CARD_MAX)) {
    const ally = job.factionRep !== null ? factionInfo(job.factionRep).code : null;
    blocks.push({
      kind: 'listRow',
      emoji: '💼',
      text: `#${job.id} · ${typeWord(job)}${ally === null ? '' : ` · ${ally}`} · ${placeName(job.pickupLocation)}`,
      trailing: rewardInfo(job.reward).label,
    });
  }
  if (jobs.length > LIST_CARD_MAX) blocks.push({ kind: 'caption', text: `+${jobs.length - LIST_CARD_MAX} more` });
  blocks.push({ kind: 'space', height: 6 }, { kind: 'divider' });

  return {
    title: 'ESSI job board',
    caption: `💼 ESSI job board · ${count}${criteria.length === 0 ? '' : `\n${criteria.join(' · ')}`}`,
    discordText,
    link,
    card: {
      title: 'ESSI · Job board',
      subtitle: count,
      blocks,
      footer: `ESSI · Job Allocation Desk · ${SITE}`,
    },
    fileName: `essi-jobs-${jobs.length}.png`,
  };
}
