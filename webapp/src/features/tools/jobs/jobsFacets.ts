/**
 * Filter-sheet facets (spec §3.5): the values each section offers (only those
 * present in the data, computed once per dataset) and their contextual counts
 * (recomputed per draft). Counts come from the same predicate as the list
 * (`compileFilter`), so a count always matches what the list shows:
 *
 * - multi-select sections (Faction, Category, Reward): jobs passing every
 *   OTHER criterion that carry the value - i.e. what the value contributes;
 * - single-value selectors (Pickup place, Skill, Shire) and the No reputation
 *   switch: jobs passing the whole filter with that value in place of the
 *   current one - exactly what the list shows once it is picked;
 * - Don't anger: jobs passing every other criterion that make that faction
 *   lose reputation - the jobs that choice hides (shown as `−n`);
 * - No prerequisites (quick chip): the whole filter with it switched on.
 */

import type { Job } from './jobModel';
import { astroKey, buildPlaces, zoneKey, type PlacesIndex } from './jobPlaces';
import {
  compileFilter,
  CRITERION,
  hasNoPrerequisite,
  NONE,
  type JobContext,
  type JobFilter,
} from './jobsLogic';
import { JOB_CATEGORIES, jobCategory } from './jobTaxonomies';

/** The values each section can offer - only those present in the data. */
export interface JobsFacetOptions {
  /** Distinct `factionRep` values. */
  factions: readonly string[];
  /** Categories present, in display order. */
  categories: readonly string[];
  rewards: readonly string[];
  skills: readonly string[];
  /** Distinct `requiredTag` values (the shires). */
  shires: readonly string[];
  /** Distinct `harmedFaction` values (Don't anger) - only factions a job really makes lose reputation. */
  rivals: readonly string[];
  places: PlacesIndex;
}

function distinct(jobs: readonly Job[], pick: (job: Job) => string | null): string[] {
  const values = new Set<string>();
  for (const job of jobs) {
    const v = pick(job);
    if (v !== null && v.length > 0) values.add(v);
  }
  return [...values].sort();
}

export function computeFacetOptions(jobs: readonly Job[]): JobsFacetOptions {
  const presentCategories = new Set(jobs.map((j) => jobCategory(j.type)));
  return {
    factions: distinct(jobs, (j) => j.factionRep),
    categories: JOB_CATEGORIES.map((c) => c.key).filter((key) => presentCategories.has(key)),
    rewards: distinct(jobs, (j) => j.reward),
    skills: distinct(jobs, (j) => j.skillRequirement?.skill ?? null),
    shires: distinct(jobs, (j) => j.requiredTag),
    rivals: distinct(jobs, (j) => j.harmedFaction),
    places: buildPlaces(jobs),
  };
}

/**
 * Drops every value the data doesn't offer (a stale localStorage entry, a
 * hand-edited link). Returns the same object when nothing changed.
 */
export function sanitizeFilter(filter: JobFilter, options: JobsFacetOptions): JobFilter {
  const keep = (set: Set<string>, allowed: readonly string[]): Set<string> => {
    const ok = new Set(allowed);
    return [...set].every((v) => ok.has(v)) ? set : new Set([...set].filter((v) => ok.has(v)));
  };
  const single = (value: string | null, allowed: readonly string[]): string | null =>
    value === null || value === NONE || allowed.includes(value) ? value : null;

  const next: JobFilter = {
    ...filter,
    factions: keep(filter.factions, options.factions),
    place: filter.place !== null && options.places.labels.has(filter.place) ? filter.place : null,
    categories: keep(filter.categories, options.categories),
    rewards: keep(filter.rewards, options.rewards),
    skill: single(filter.skill, options.skills),
    shire: single(filter.shire, options.shires),
    avoidRivals: keep(filter.avoidRivals, options.rivals),
  };
  const changed =
    next.factions !== filter.factions ||
    next.place !== filter.place ||
    next.categories !== filter.categories ||
    next.rewards !== filter.rewards ||
    next.skill !== filter.skill ||
    next.shire !== filter.shire ||
    next.avoidRivals !== filter.avoidRivals;
  return changed ? next : filter;
}

export interface JobsFacetCounts {
  /** Jobs the full filter keeps ("Show N jobs"). */
  total: number;
  factions: ReadonlyMap<string, number>;
  categories: ReadonlyMap<string, number>;
  rewards: ReadonlyMap<string, number>;
  /** Place key (`ast:` and `zone:`) → jobs listed once that place is picked. */
  places: ReadonlyMap<string, number>;
  /** Jobs listed with "Any place". */
  placeAny: number;
  /** Skill (or NONE) → jobs listed once picked. */
  skills: ReadonlyMap<string, number>;
  skillAny: number;
  /** Shire (or NONE) → jobs listed once picked (a shire includes the open-to-all jobs). */
  shires: ReadonlyMap<string, number>;
  shireAny: number;
  /** Jobs listed with "No reputation needed" on. */
  noRep: number;
  /** Harmed faction → jobs that choice hides. */
  avoidRivals: ReadonlyMap<string, number>;
  /** Jobs listed with the No prerequisites quick chip on. */
  noPrereq: number;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** One pass over the jobs: each job's failure mask says which "all criteria but X" sets it belongs to. */
export function computeFacetCounts(jobs: readonly Job[], filter: JobFilter, ctx: JobContext): JobsFacetCounts {
  const failedOf = compileFilter(filter, ctx);
  const passesBut = (failed: number, criterion: number) => (failed & ~criterion) === 0;

  let total = 0;
  let placeAny = 0;
  let skillAny = 0;
  let shireAny = 0;
  let noRep = 0;
  let noPrereq = 0;
  const factions = new Map<string, number>();
  const categories = new Map<string, number>();
  const rewards = new Map<string, number>();
  const places = new Map<string, number>();
  const skills = new Map<string, number>();
  const tags = new Map<string, number>();
  const allTags = new Set<string>();
  const avoidRivals = new Map<string, number>();

  for (const job of jobs) {
    const failed = failedOf(job);
    if (failed === 0) total++;
    if (job.requiredTag !== null) allTags.add(job.requiredTag);
    if (passesBut(failed, CRITERION.factions) && job.factionRep !== null) bump(factions, job.factionRep);
    if (passesBut(failed, CRITERION.categories)) bump(categories, jobCategory(job.type));
    if (passesBut(failed, CRITERION.rewards)) bump(rewards, job.reward);
    if (passesBut(failed, CRITERION.place)) {
      placeAny++;
      const { astnum, zone } = job.pickupLocation;
      bump(places, astroKey(astnum));
      bump(places, zoneKey(astnum, zone));
    }
    if (passesBut(failed, CRITERION.skill)) {
      skillAny++;
      bump(skills, job.skillRequirement?.skill ?? NONE);
    }
    if (passesBut(failed, CRITERION.shire)) {
      shireAny++;
      bump(tags, job.requiredTag ?? NONE);
    }
    if (passesBut(failed, CRITERION.noRep) && job.requiredRep === 0) noRep++;
    if (passesBut(failed, CRITERION.avoidRivals) && job.harmedFaction !== null) bump(avoidRivals, job.harmedFaction);
    if (passesBut(failed, CRITERION.noPrereq) && hasNoPrerequisite(job)) noPrereq++;
  }

  // A shire keeps the open-to-all jobs plus its own - even when none of its own pass.
  const openToAll = tags.get(NONE) ?? 0;
  const shires = new Map<string, number>([[NONE, openToAll]]);
  for (const tag of allTags) shires.set(tag, openToAll + (tags.get(tag) ?? 0));

  return {
    total,
    factions,
    categories,
    rewards,
    places,
    placeAny,
    skills,
    skillAny,
    shires,
    shireAny,
    noRep,
    avoidRivals,
    noPrereq,
  };
}

/** Count of a value in a counts map (absent → 0). */
export function countOf(map: ReadonlyMap<string, number>, key: string): number {
  return map.get(key) ?? 0;
}

/** Keys ranked by count desc, then label (the chip order). */
export function rankByCount(
  keys: readonly string[],
  counts: ReadonlyMap<string, number>,
  labelOf: (key: string) => string,
): string[] {
  return [...keys].sort(
    (a, b) => countOf(counts, b) - countOf(counts, a) || labelOf(a).localeCompare(labelOf(b)),
  );
}
