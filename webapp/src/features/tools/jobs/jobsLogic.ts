/**
 * Jobs filtering & sorting logic (spec §3.7) - the filter model, the single
 * full predicate (sheet sections + search + quick filters + favorites/status),
 * sort comparators, and the removable active-filter chip descriptors. Kept
 * pure so it can be unit-tested (jobsLogic.test.ts) with no React or DB.
 */

import type { JobStatusValue } from '../../../data/db';
import type { Job } from './jobModel';
import { ASTNUM_LABELS, parsePlaceKey, placeContains, placeLabel, zoneKey, type PlacesIndex } from './jobPlaces';
import {
  ACCENT_SUCCESS,
  categoryLabel,
  factionInfo,
  jobCategory,
  rewardInfo,
  skillLabel,
  skillTint,
  tagLabel,
} from './jobTaxonomies';

const ACCENT_PRIMARY = '#4FC3FF';
const ACCENT_SECONDARY = '#7AE3FF';

export type JobSort = 'idAsc' | 'bonusDesc' | 'bonusAsc' | 'riskAsc' | 'riskDesc' | 'repAsc';

export interface JobSortOption {
  value: JobSort;
  label: string;
  compare: (a: Job, b: Job) => number;
}

/** Sorts in the order shown in the popup menu (idAsc default first). */
export const JOB_SORTS: readonly JobSortOption[] = [
  { value: 'idAsc', label: 'ID ↑', compare: (a, b) => a.id - b.id },
  { value: 'bonusDesc', label: 'Bonus ↓', compare: (a, b) => b.bonus - a.bonus },
  { value: 'bonusAsc', label: 'Bonus ↑', compare: (a, b) => a.bonus - b.bonus },
  { value: 'riskAsc', label: 'Risk ↑', compare: (a, b) => a.risk - b.risk },
  { value: 'riskDesc', label: 'Risk ↓', compare: (a, b) => b.risk - a.risk },
  { value: 'repAsc', label: 'Reputation needed ↑', compare: (a, b) => a.requiredRep - b.requiredRep },
];

const SORT_BY_VALUE = new Map(JOB_SORTS.map((s) => [s.value, s]));

export function isJobSort(value: unknown): value is JobSort {
  return typeof value === 'string' && SORT_BY_VALUE.has(value as JobSort);
}

export function sortLabel(sort: JobSort): string {
  return SORT_BY_VALUE.get(sort)?.label ?? sort;
}

/** Selector value meaning "the job requires none" (Skill → no skill, Shire → open to all only). */
export const NONE = '__none__';

export const JOB_STATUSES: readonly JobStatusValue[] = ['todo', 'in_progress', 'done'];

export interface JobFilter {
  query: string;
  // Filter sheet - six sections.
  /** 1 Faction: `factionRep` in the set (OR). */
  factions: Set<string>;
  /** 2 Pickup place: `ast:{astnum}` or `zone:{astnum}:{zone}` (see jobPlaces). */
  place: string | null;
  /** 3 Category: the type's category key in the set (OR). */
  categories: Set<string>;
  /** 4 Reward: canonical reward in the set (OR). */
  rewards: Set<string>;
  /** 5 Requirements: null = any; NONE = no skill required; else that exact skill. */
  skill: string | null;
  /** 5 Requirements: null = any; NONE = open-to-all jobs only; else open-to-all + that shire's jobs. */
  shire: string | null;
  /** 5 Requirements: `requiredRep === 0`. */
  noRepOnly: boolean;
  /** 6 Don't anger: EXCLUDES jobs whose `factionRival` is in the set. */
  avoidRivals: Set<string>;
  // Quick filters (chip row under the search field).
  /** No reputation, no skill and no shire required. */
  noPrereqOnly: boolean;
  starredOnly: boolean;
  /** Progress (OR); absent status row = `todo`. */
  statuses: Set<JobStatusValue>;
  sort: JobSort;
}

/** The pristine (no-op) filter. */
export function pristineFilter(): JobFilter {
  return {
    query: '',
    factions: new Set(),
    place: null,
    categories: new Set(),
    rewards: new Set(),
    skill: null,
    shire: null,
    noRepOnly: false,
    avoidRivals: new Set(),
    noPrereqOnly: false,
    starredOnly: false,
    statuses: new Set(),
    sort: 'idAsc',
  };
}

/** The sheet's Reset: clears the six sheet sections only (search, quick filters and sort are kept). */
export function resetSheetSections(filter: JobFilter): JobFilter {
  return {
    ...filter,
    factions: new Set(),
    place: null,
    categories: new Set(),
    rewards: new Set(),
    skill: null,
    shire: null,
    noRepOnly: false,
    avoidRivals: new Set(),
  };
}

/** The empty state's escape hatch: sheet + quick filters + search cleared, sort kept. */
export function resetAllFilters(filter: JobFilter): JobFilter {
  return { ...pristineFilter(), sort: filter.sort };
}

/** Active sheet sections (0-6) - the Filters-button badge. Search and quick filters are not counted. */
export function activeSectionCount(filter: JobFilter): number {
  let n = 0;
  if (filter.factions.size > 0) n++;
  if (filter.place !== null) n++;
  if (filter.categories.size > 0) n++;
  if (filter.rewards.size > 0) n++;
  if (filter.skill !== null || filter.shire !== null || filter.noRepOnly) n++;
  if (filter.avoidRivals.size > 0) n++;
  return n;
}

/** Whether anything narrows the list (sheet, quick filters or search). */
export function hasAnyCriteria(filter: JobFilter): boolean {
  return (
    activeSectionCount(filter) > 0 ||
    filter.noPrereqOnly ||
    filter.starredOnly ||
    filter.statuses.size > 0 ||
    parseQuery(filter.query).length > 0
  );
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Structural equality (sets compared by content). */
export function filtersEqual(a: JobFilter, b: JobFilter): boolean {
  return (
    a.query === b.query &&
    sameSet(a.factions, b.factions) &&
    a.place === b.place &&
    sameSet(a.categories, b.categories) &&
    sameSet(a.rewards, b.rewards) &&
    a.skill === b.skill &&
    a.shire === b.shire &&
    a.noRepOnly === b.noRepOnly &&
    sameSet(a.avoidRivals, b.avoidRivals) &&
    a.noPrereqOnly === b.noPrereqOnly &&
    a.starredOnly === b.starredOnly &&
    sameSet(a.statuses, b.statuses) &&
    a.sort === b.sort
  );
}

// --- Search -----------------------------------------------------------------

/** Query → lowercase words (trimmed, split on whitespace, a leading `#` dropped so `#35511202` finds the ID). */
export function parseQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.startsWith('#') ? word.slice(1) : word))
    .filter((word) => word.length > 0);
}

/** Haystacks per zone-name table (a dataset's), then per job. */
const haystackCaches = new WeakMap<object, WeakMap<Job, string>>();
const NO_ZONE_NAMES = {};

/**
 * Everything a search word may match, lowercased: texts, ID, raw type,
 * category, faction (ally + rival), reward, skill, shire, and the pickup /
 * dropoff names (+ the astro name when known, + the name the place picker
 * gives the zone when `zoneNames` is passed - a job filed under "Docking Port"
 * is found by that name even if its own reads "Docking Bay"). Cached per job.
 */
export function jobHaystack(job: Job, zoneNames?: ReadonlyMap<string, string>): string {
  let cache = haystackCaches.get(zoneNames ?? NO_ZONE_NAMES);
  if (cache === undefined) {
    cache = new WeakMap();
    haystackCaches.set(zoneNames ?? NO_ZONE_NAMES, cache);
  }
  const cached = cache.get(job);
  if (cached !== undefined) return cached;
  const parts = [
    job.description,
    job.onComplete,
    String(job.id),
    job.typeRaw,
    categoryLabel(jobCategory(job.type)),
    rewardInfo(job.reward).label,
  ];
  if (job.factionRep !== null) parts.push(factionInfo(job.factionRep).label);
  if (job.factionRival !== null) parts.push(factionInfo(job.factionRival).label);
  if (job.requiredSkill !== null) parts.push(job.requiredSkill, skillLabel(job.requiredSkill));
  if (job.requiredTag !== null) parts.push(tagLabel(job.requiredTag));
  for (const loc of [job.pickupLocation, job.dropoffLocation]) {
    if (loc.name !== null) parts.push(loc.name);
    const canonical = zoneNames?.get(zoneKey(loc.astnum, loc.zone));
    if (canonical !== undefined && canonical !== loc.name) parts.push(canonical);
    const astro = ASTNUM_LABELS[loc.astnum];
    if (astro !== undefined) parts.push(astro);
  }
  const haystack = parts.join('\n').toLowerCase();
  cache.set(job, haystack);
  return haystack;
}

// --- The predicate ------------------------------------------------------------

/** External per-job state read by the companion filters (favorites + progress), plus the dataset's zone names for the search. */
export interface JobContext {
  starred: ReadonlySet<string>;
  statusMap: ReadonlyMap<string, JobStatusValue>;
  /** `PlacesIndex.zoneNames` - lets the search match the names the place picker shows. */
  zoneNames?: ReadonlyMap<string, string>;
}

export const EMPTY_CONTEXT: JobContext = { starred: new Set(), statusMap: new Map() };

/** One bit per criterion - `compileFilter` returns the set a job fails. */
export const CRITERION = {
  query: 1 << 0,
  factions: 1 << 1,
  place: 1 << 2,
  categories: 1 << 3,
  rewards: 1 << 4,
  skill: 1 << 5,
  shire: 1 << 6,
  noRep: 1 << 7,
  avoidRivals: 1 << 8,
  noPrereq: 1 << 9,
  starred: 1 << 10,
  statuses: 1 << 11,
} as const;

/** No reputation, no skill, no shire. */
export function hasNoPrerequisite(job: Job): boolean {
  return job.requiredRep === 0 && job.requiredSkill === null && job.requiredTag === null;
}

/**
 * THE job predicate. Returns a function giving the bitmask of failed criteria
 * (0 = the job is listed). Criteria are ANDed; values inside a multi-select
 * section are ORed; Don't anger excludes. Both the list and the sheet's
 * "Show N jobs" / contextual counts use this, so they can never disagree.
 */
export function compileFilter(filter: JobFilter, ctx: JobContext): (job: Job) => number {
  const words = parseQuery(filter.query);
  const place = filter.place === null ? null : parsePlaceKey(filter.place);
  const { factions, categories, rewards, avoidRivals, statuses, skill, shire } = filter;
  return (job) => {
    let failed = 0;
    if (words.length > 0) {
      const haystack = jobHaystack(job, ctx.zoneNames);
      if (!words.every((w) => haystack.includes(w))) failed |= CRITERION.query;
    }
    if (factions.size > 0 && (job.factionRep === null || !factions.has(job.factionRep))) failed |= CRITERION.factions;
    // A malformed place key matches nothing (it is sanitized away on load).
    if (filter.place !== null && (place === null || !placeContains(place, job.pickupLocation))) failed |= CRITERION.place;
    if (categories.size > 0 && !categories.has(jobCategory(job.type))) failed |= CRITERION.categories;
    if (rewards.size > 0 && !rewards.has(job.reward)) failed |= CRITERION.rewards;
    if (skill !== null && job.requiredSkill !== (skill === NONE ? null : skill)) failed |= CRITERION.skill;
    if (shire !== null && job.requiredTag !== null && (shire === NONE || job.requiredTag !== shire)) failed |= CRITERION.shire;
    if (filter.noRepOnly && job.requiredRep !== 0) failed |= CRITERION.noRep;
    if (avoidRivals.size > 0 && job.factionRival !== null && avoidRivals.has(job.factionRival)) failed |= CRITERION.avoidRivals;
    if (filter.noPrereqOnly && !hasNoPrerequisite(job)) failed |= CRITERION.noPrereq;
    if (filter.starredOnly && !ctx.starred.has(String(job.id))) failed |= CRITERION.starred;
    if (statuses.size > 0 && !statuses.has(ctx.statusMap.get(String(job.id)) ?? 'todo')) failed |= CRITERION.statuses;
    return failed;
  };
}

/** Number of jobs the full predicate keeps. */
export function countMatching(jobs: readonly Job[], filter: JobFilter, ctx: JobContext): number {
  const failed = compileFilter(filter, ctx);
  let n = 0;
  for (const job of jobs) if (failed(job) === 0) n++;
  return n;
}

/** The visible list: the full predicate, then the chosen sort (stable, so ties keep file order). */
export function visibleJobs(jobs: readonly Job[], filter: JobFilter, ctx: JobContext): Job[] {
  const failed = compileFilter(filter, ctx);
  const compare = (SORT_BY_VALUE.get(filter.sort) ?? JOB_SORTS[0]!).compare;
  return jobs.filter((job) => failed(job) === 0).sort(compare);
}

// --- Active-filter chips ------------------------------------------------------

export interface ActiveChip {
  id: string;
  label: string;
  tint: string;
  /** A pure filter transform that removes this criterion. */
  remove: (f: JobFilter) => JobFilter;
}

function withoutMember<T>(set: Set<T>, member: T): Set<T> {
  const next = new Set(set);
  next.delete(member);
  return next;
}

/**
 * The removable chips for the active-filter row (§3.3.4): one per sheet
 * criterion, in sheet order, with plain-language labels. Search and quick
 * filters are excluded (they have their own controls).
 */
export function activeFilterChips(filter: JobFilter, places: PlacesIndex | null): ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const key of filter.factions) {
    const info = factionInfo(key);
    chips.push({
      id: `faction:${key}`,
      label: info.label,
      tint: info.tint,
      remove: (f) => ({ ...f, factions: withoutMember(f.factions, key) }),
    });
  }
  if (filter.place !== null) {
    chips.push({
      id: 'place',
      label: `From: ${placeLabel(places, filter.place)}`,
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, place: null }),
    });
  }
  for (const key of filter.categories) {
    chips.push({
      id: `category:${key}`,
      label: categoryLabel(key),
      tint: ACCENT_PRIMARY,
      remove: (f) => ({ ...f, categories: withoutMember(f.categories, key) }),
    });
  }
  for (const key of filter.rewards) {
    const info = rewardInfo(key);
    chips.push({
      id: `reward:${key}`,
      label: `Reward: ${info.label}`,
      tint: info.tint,
      remove: (f) => ({ ...f, rewards: withoutMember(f.rewards, key) }),
    });
  }
  if (filter.skill !== null) {
    chips.push({
      id: 'skill',
      label: filter.skill === NONE ? 'No skill needed' : `Skill: ${skillLabel(filter.skill)}`,
      tint: filter.skill === NONE ? ACCENT_SECONDARY : skillTint(filter.skill),
      remove: (f) => ({ ...f, skill: null }),
    });
  }
  if (filter.shire !== null) {
    chips.push({
      id: 'shire',
      label: filter.shire === NONE ? 'Open to all only' : `Shire: ${tagLabel(filter.shire)}`,
      tint: ACCENT_SUCCESS,
      remove: (f) => ({ ...f, shire: null }),
    });
  }
  if (filter.noRepOnly) {
    chips.push({
      id: 'noRep',
      label: 'No reputation needed',
      tint: ACCENT_SECONDARY,
      remove: (f) => ({ ...f, noRepOnly: false }),
    });
  }
  for (const key of filter.avoidRivals) {
    const info = factionInfo(key);
    chips.push({
      id: `avoid:${key}`,
      label: `Don't anger ${info.label}`,
      tint: info.tint,
      remove: (f) => ({ ...f, avoidRivals: withoutMember(f.avoidRivals, key) }),
    });
  }
  return chips;
}
