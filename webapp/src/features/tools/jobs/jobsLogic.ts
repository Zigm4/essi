/**
 * Jobs filtering & sorting logic (spec §3.7) — the exact `accepts` predicate,
 * companion filter, active-filter count, sort comparators, and the removable
 * active-filter chip descriptors. Kept pure so it can be unit-tested
 * (jobsLogic.test.ts) with no React or DB.
 */

import type { JobStatusValue } from '../../../data/db';
import type { Job } from './jobModel';
import {
  ACCENT_SUCCESS,
  factionInfo,
  rewardInfo,
  skillTint,
  tagLabel,
} from './jobTaxonomies';

const ACCENT_PRIMARY = '#4FC3FF';
const ACCENT_SECONDARY = '#7AE3FF';
const ACCENT_WARN = '#FFB347';
const ACCENT_DANGER = '#FF5577';
const TEXT_DIM = '#6E8AAB';

export type Range = [number, number];

export type JobSort =
  | 'idAsc'
  | 'riskAsc'
  | 'riskDesc'
  | 'bonusDesc'
  | 'bonusAsc'
  | 'skillAmtDesc'
  | 'skillAmtAsc';

export interface JobSortOption {
  value: JobSort;
  label: string;
  compare: (a: Job, b: Job) => number;
}

/** Sorts in the order shown in the popup menu (idAsc default first). */
export const JOB_SORTS: readonly JobSortOption[] = [
  { value: 'idAsc', label: 'ID ↑', compare: (a, b) => a.id - b.id },
  { value: 'riskAsc', label: 'Risk ↑', compare: (a, b) => a.risk - b.risk },
  { value: 'riskDesc', label: 'Risk ↓', compare: (a, b) => b.risk - a.risk },
  { value: 'bonusDesc', label: 'Bonus ↓', compare: (a, b) => b.bonus - a.bonus },
  { value: 'bonusAsc', label: 'Bonus ↑', compare: (a, b) => a.bonus - b.bonus },
  { value: 'skillAmtDesc', label: 'Skill req ↓', compare: (a, b) => b.requiredSkillAmt - a.requiredSkillAmt },
  { value: 'skillAmtAsc', label: 'Skill req ↑', compare: (a, b) => a.requiredSkillAmt - b.requiredSkillAmt },
];

const SORT_BY_VALUE = new Map(JOB_SORTS.map((s) => [s.value, s]));

export function sortLabel(sort: JobSort): string {
  return SORT_BY_VALUE.get(sort)?.label ?? sort;
}

export interface JobFilter {
  query: string;
  types: Set<string>;
  alliedFactions: Set<string>;
  rivalFactions: Set<string>;
  rewards: Set<string>;
  skills: Set<string>;
  tags: Set<string>;
  skillAmt: Range;
  requiredRep: Range;
  risk: Range;
  bonus: Range;
  /** Real bonus data extent once known (collapsed into `bonus` when the sheet opens). */
  bonusMin: number;
  bonusMax: number;
  pickupAstnum: number | null;
  pickupZone: number | null;
  dropoffAstnum: number | null;
  dropoffZone: number | null;
  onSiteOnly: boolean;
  cargoJobsOnly: boolean;
  rivalImpactOnly: boolean;
  hidePlaceholder: boolean;
  // Companion filters (evaluated against external state).
  starredOnly: boolean;
  statuses: Set<JobStatusValue>;
  sort: JobSort;
}

/** The pristine (no-op) filter (§3.7). Bonus range is unbounded until snapped. */
export function pristineFilter(): JobFilter {
  return {
    query: '',
    types: new Set(),
    alliedFactions: new Set(),
    rivalFactions: new Set(),
    rewards: new Set(),
    skills: new Set(),
    tags: new Set(),
    skillAmt: [0, 100],
    requiredRep: [0, 8],
    risk: [0, 14],
    bonus: [-Infinity, Infinity],
    bonusMin: -Infinity,
    bonusMax: Infinity,
    pickupAstnum: null,
    pickupZone: null,
    dropoffAstnum: null,
    dropoffZone: null,
    onSiteOnly: false,
    cargoJobsOnly: false,
    rivalImpactOnly: false,
    hidePlaceholder: false,
    starredOnly: false,
    statuses: new Set(),
    sort: 'idAsc',
  };
}

/** The actual bonus [min, max] over the loaded jobs (§3.5). Empty → [0, 1]. */
export function bonusExtent(jobs: readonly Job[]): Range {
  if (jobs.length === 0) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const job of jobs) {
    if (job.bonus < min) min = job.bonus;
    if (job.bonus > max) max = job.bonus;
  }
  if (max <= min) max = min + 1; // guard
  return [min, max];
}

/**
 * The job-intrinsic predicate (§3.7). All conditions ANDed; any failure
 * rejects. The companion (starred/status) filters are NOT applied here.
 */
export function accepts(filter: JobFilter, job: Job): boolean {
  // 1. Query.
  const query = filter.query.toLowerCase();
  if (query.length > 0) {
    const haystack = `${job.description}\n${job.onComplete}\n${job.id}\n${job.typeRaw}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  // 2. Types.
  if (filter.types.size > 0 && !filter.types.has(job.type)) return false;
  // 3. Allied factions.
  if (filter.alliedFactions.size > 0) {
    if (job.factionRep === null || !filter.alliedFactions.has(job.factionRep)) return false;
  }
  // 4. Rival factions.
  if (filter.rivalFactions.size > 0) {
    if (job.factionRival === null || !filter.rivalFactions.has(job.factionRival)) return false;
  }
  // 5. Rewards.
  if (filter.rewards.size > 0 && !filter.rewards.has(job.reward)) return false;
  // 6. Skills.
  if (filter.skills.size > 0) {
    if (job.requiredSkill === null || !filter.skills.has(job.requiredSkill)) return false;
  }
  // 7. Tags.
  if (filter.tags.size > 0) {
    if (job.requiredTag === null || !filter.tags.has(job.requiredTag)) return false;
  }
  // 8–11. Ranges.
  if (job.requiredSkillAmt < filter.skillAmt[0] || job.requiredSkillAmt > filter.skillAmt[1]) return false;
  if (job.requiredRep < filter.requiredRep[0] || job.requiredRep > filter.requiredRep[1]) return false;
  if (job.risk < filter.risk[0] || job.risk > filter.risk[1]) return false;
  if (job.bonus < filter.bonus[0] || job.bonus > filter.bonus[1]) return false;
  // 12. Location equality.
  if (filter.pickupAstnum !== null && job.pickupLocation.astnum !== filter.pickupAstnum) return false;
  if (filter.pickupZone !== null && job.pickupLocation.zone !== filter.pickupZone) return false;
  if (filter.dropoffAstnum !== null && job.dropoffLocation.astnum !== filter.dropoffAstnum) return false;
  if (filter.dropoffZone !== null && job.dropoffLocation.zone !== filter.dropoffZone) return false;
  // 13. Boolean flags.
  if (filter.onSiteOnly && !job.isOnSite) return false;
  if (filter.cargoJobsOnly && !job.isCargoJob) return false;
  if (filter.rivalImpactOnly && !job.hasRival) return false;
  if (filter.hidePlaceholder && job.isPlaceholderType) return false;
  return true;
}

/** The companion predicate — starred/status, evaluated with external state (§3.7). */
export function acceptsCompanion(
  filter: JobFilter,
  isStarred: boolean,
  status: JobStatusValue,
): boolean {
  if (filter.starredOnly && !isStarred) return false;
  if (filter.statuses.size > 0 && !filter.statuses.has(status)) return false;
  return true;
}

/**
 * The count that drives the Filters-button badge (§3.7). Excludes sort. Bonus
 * counts only when narrowed strictly inside [bonusMin, bonusMax].
 */
export function activeCount(filter: JobFilter): number {
  let n = 0;
  if (filter.query.length > 0) n++;
  if (filter.types.size > 0) n++;
  if (filter.alliedFactions.size > 0) n++;
  if (filter.rivalFactions.size > 0) n++;
  if (filter.rewards.size > 0) n++;
  if (filter.skills.size > 0) n++;
  if (filter.tags.size > 0) n++;
  if (filter.skillAmt[0] !== 0 || filter.skillAmt[1] !== 100) n++;
  if (filter.requiredRep[0] !== 0 || filter.requiredRep[1] !== 8) n++;
  if (filter.risk[0] !== 0 || filter.risk[1] !== 14) n++;
  if (filter.bonus[0] > filter.bonusMin || filter.bonus[1] < filter.bonusMax) n++;
  if (filter.pickupAstnum !== null) n++;
  if (filter.pickupZone !== null) n++;
  if (filter.dropoffAstnum !== null) n++;
  if (filter.dropoffZone !== null) n++;
  if (filter.onSiteOnly) n++;
  if (filter.cargoJobsOnly) n++;
  if (filter.rivalImpactOnly) n++;
  if (filter.hidePlaceholder) n++;
  if (filter.starredOnly) n++;
  if (filter.statuses.size > 0) n++;
  return n;
}

/** The rounded bonus label used by the chip and the slider readout. */
function roundBonus(v: number): number {
  return Number.isFinite(v) ? Math.round(v) : 0;
}

export interface ActiveChip {
  id: string;
  label: string;
  tint: string;
  /** A pure filter transform that removes this criterion. */
  remove: (f: JobFilter) => JobFilter;
}

function withoutSetMember(set: Set<string>, member: string): Set<string> {
  const next = new Set(set);
  next.delete(member);
  return next;
}

/**
 * The removable chips for the active-filter row (§3.3.4), in exact spec order.
 * Query is intentionally excluded (it lives in the search field), as are the
 * companion filters (they have their own quick-chip row).
 */
export function activeFilterChips(filter: JobFilter): ActiveChip[] {
  const chips: ActiveChip[] = [];

  for (const type of filter.types) {
    chips.push({
      id: `type:${type}`,
      label: `type: ${type}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, types: withoutSetMember(f.types, type) }),
    });
  }
  for (const key of filter.alliedFactions) {
    chips.push({
      id: `ally:${key}`,
      label: `ally: ${factionInfo(key).label}`,
      tint: factionInfo(key).tint,
      remove: (f) => ({ ...f, alliedFactions: withoutSetMember(f.alliedFactions, key) }),
    });
  }
  for (const key of filter.rivalFactions) {
    chips.push({
      id: `rival:${key}`,
      label: `rival: ${factionInfo(key).label}`,
      tint: factionInfo(key).tint,
      remove: (f) => ({ ...f, rivalFactions: withoutSetMember(f.rivalFactions, key) }),
    });
  }
  for (const key of filter.rewards) {
    chips.push({
      id: `reward:${key}`,
      label: `reward: ${rewardInfo(key).label}`,
      tint: rewardInfo(key).tint,
      remove: (f) => ({ ...f, rewards: withoutSetMember(f.rewards, key) }),
    });
  }
  for (const key of filter.skills) {
    chips.push({
      id: `skill:${key}`,
      label: `skill: ${key}`,
      tint: skillTint(key),
      remove: (f) => ({ ...f, skills: withoutSetMember(f.skills, key) }),
    });
  }
  for (const key of filter.tags) {
    chips.push({
      id: `tag:${key}`,
      label: `tag: ${tagLabel(key)}`,
      tint: ACCENT_SUCCESS,
      remove: (f) => ({ ...f, tags: withoutSetMember(f.tags, key) }),
    });
  }
  if (filter.skillAmt[0] !== 0 || filter.skillAmt[1] !== 100) {
    chips.push({
      id: 'skillAmt',
      label: `skill ≥${filter.skillAmt[0]}..${filter.skillAmt[1]}`,
      tint: ACCENT_SECONDARY,
      remove: (f) => ({ ...f, skillAmt: [0, 100] }),
    });
  }
  if (filter.requiredRep[0] !== 0 || filter.requiredRep[1] !== 8) {
    chips.push({
      id: 'rep',
      label: `rep ${filter.requiredRep[0]}..${filter.requiredRep[1]}`,
      tint: ACCENT_SECONDARY,
      remove: (f) => ({ ...f, requiredRep: [0, 8] }),
    });
  }
  if (filter.risk[0] !== 0 || filter.risk[1] !== 14) {
    chips.push({
      id: 'risk',
      label: `risk ${filter.risk[0]}..${filter.risk[1]}`,
      tint: ACCENT_WARN,
      remove: (f) => ({ ...f, risk: [0, 14] }),
    });
  }
  if (filter.bonus[0] > filter.bonusMin || filter.bonus[1] < filter.bonusMax) {
    chips.push({
      id: 'bonus',
      label: `bonus ${roundBonus(filter.bonus[0])}..${roundBonus(filter.bonus[1])}`,
      tint: ACCENT_WARN,
      remove: (f) => ({ ...f, bonus: [f.bonusMin, f.bonusMax] }),
    });
  }
  if (filter.pickupAstnum !== null) {
    chips.push({
      id: 'pickupAst',
      label: `pickup ast ${filter.pickupAstnum}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, pickupAstnum: null }),
    });
  }
  if (filter.pickupZone !== null) {
    chips.push({
      id: 'pickupZone',
      label: `pickup z${filter.pickupZone}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, pickupZone: null }),
    });
  }
  if (filter.dropoffAstnum !== null) {
    chips.push({
      id: 'dropoffAst',
      label: `dropoff ast ${filter.dropoffAstnum}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, dropoffAstnum: null }),
    });
  }
  if (filter.dropoffZone !== null) {
    chips.push({
      id: 'dropoffZone',
      label: `dropoff z${filter.dropoffZone}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, dropoffZone: null }),
    });
  }
  if (filter.onSiteOnly) {
    chips.push({ id: 'onSite', label: 'on-site only', tint: ACCENT_SUCCESS, remove: (f) => ({ ...f, onSiteOnly: false }) });
  }
  if (filter.cargoJobsOnly) {
    chips.push({ id: 'cargo', label: 'cargo only', tint: ACCENT_WARN, remove: (f) => ({ ...f, cargoJobsOnly: false }) });
  }
  if (filter.rivalImpactOnly) {
    chips.push({ id: 'rivalImpact', label: 'rival impact', tint: ACCENT_DANGER, remove: (f) => ({ ...f, rivalImpactOnly: false }) });
  }
  if (filter.hidePlaceholder) {
    chips.push({ id: 'hidePlaceholder', label: 'hide ???', tint: TEXT_DIM, remove: (f) => ({ ...f, hidePlaceholder: false }) });
  }

  return chips;
}

/**
 * The visible, sorted job list: intrinsic + companion predicates, then the
 * chosen sort (Array.sort is stable, so equal keys keep file order).
 */
export function visibleJobs(
  jobs: readonly Job[],
  filter: JobFilter,
  starred: ReadonlySet<string>,
  statusMap: ReadonlyMap<string, JobStatusValue>,
): Job[] {
  const compare = (SORT_BY_VALUE.get(filter.sort) ?? JOB_SORTS[0]!).compare;
  return jobs
    .filter((job) => {
      if (!accepts(filter, job)) return false;
      const key = String(job.id);
      return acceptsCompanion(filter, starred.has(key), statusMap.get(key) ?? 'todo');
    })
    .sort(compare);
}
