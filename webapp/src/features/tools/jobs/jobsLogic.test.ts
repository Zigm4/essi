// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { canonicalReward, coordsLabel, locationLabel, parseJobsJson, type Job } from './jobModel';
import { buildPlaces } from './jobPlaces';
import {
  activeFilterChips,
  activeSectionCount,
  countMatching,
  EMPTY_CONTEXT,
  filtersEqual,
  hasAnyCriteria,
  hasNoPrerequisite,
  JOB_SORTS,
  jobHaystack,
  NONE,
  parseQuery,
  pristineFilter,
  resetAllFilters,
  resetSheetSections,
  sortLabel,
  visibleJobs,
  type JobContext,
  type JobFilter,
} from './jobsLogic';
import { categoryLabel, jobCategory, JOB_CATEGORIES, skillLabel } from './jobTaxonomies';

const jobs = parseJobsJson(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/catalog/jobs.json', import.meta.url)), 'utf-8'),
  ),
);

function jobById(id: number): Job {
  const job = jobs.find((j) => j.id === id);
  if (job === undefined) throw new Error(`job ${id} not found`);
  return job;
}

function count(partial: Partial<JobFilter>, ctx: JobContext = EMPTY_CONTEXT): number {
  return countMatching(jobs, { ...pristineFilter(), ...partial }, ctx);
}

function ids(partial: Partial<JobFilter>): number[] {
  return visibleJobs(jobs, { ...pristineFilter(), ...partial }, EMPTY_CONTEXT).map((j) => j.id);
}

describe('parseJobsJson', () => {
  it('parses all 371 rows (incl. the duplicate id 30107301)', () => {
    expect(jobs.length).toBe(371);
    expect(jobs.filter((j) => j.id === 30107301).length).toBe(2);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(370);
  });

  it('skips malformed rows without throwing', () => {
    const parsed = parseJobsJson([
      { id: 1, pickupLocation: { astnum: 1, zone: 2 }, dropoffLocation: { astnum: 1, zone: 2 } },
      null,
      42,
      { noId: true },
      { id: 2, pickupLocation: { astnum: 1, zone: 2 } }, // missing dropoff
    ]);
    expect(parsed.map((j) => j.id)).toEqual([1]);
  });

  it('derives flags and defaults', () => {
    const first = jobById(35511202);
    expect(first.typeRaw).toBe('beginner');
    expect(first.type).toBe('beginner');
    expect(first.reward).toBe('rocks');
    expect(first.isCargoJob).toBe(false);
    expect(first.isOnSite).toBe(false);
  });

  it('canonicalises rewards by function then by raw fixups', () => {
    expect(canonicalReward('coin', 'addCarryCoinAmt')).toBe('coin');
    expect(canonicalReward('anything', 'addTungstenAmt')).toBe('wolfram');
    expect(canonicalReward('SCRP', null)).toBe('scrap');
    expect(canonicalReward('NRG', null)).toBe('energy');
    expect(canonicalReward('enrgy', null)).toBe('energy');
    expect(canonicalReward('DATA', null)).toBe('data');
  });
});

describe('location labels', () => {
  it('formats coords and full labels', () => {
    expect(coordsLabel({ astnum: 355, zone: 35, name: null })).toBe('355 · z35');
    expect(locationLabel({ astnum: 355, zone: 35, name: 'Northshire' })).toBe('Northshire (355 · z35)');
    expect(locationLabel({ astnum: 355, zone: 35, name: null })).toBe('355 · z35');
  });
});

describe('skill labels', () => {
  it('capitalises keys and spells out carryCoin', () => {
    expect(skillLabel('stealth')).toBe('Stealth');
    expect(skillLabel('carryCoin')).toBe('Carry coin');
  });
});

describe('job categories', () => {
  it('folds the type buckets into six categories with the real counts', () => {
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const key = jobCategory(job.type);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      beginner: 24,
      'skill-gain': 113,
      standard: 188,
      expansion: 33,
      event: 5,
      unknown: 8,
    });
  });

  it('maps Regular and Other to Standard, listed in display order', () => {
    expect(jobCategory('transport')).toBe('standard');
    expect(jobCategory('some new type')).toBe('standard');
    expect(jobCategory('???')).toBe('unknown');
    expect(JOB_CATEGORIES.map((c) => c.label)).toEqual([
      'Beginner',
      'Skill gain',
      'Standard',
      'Expansion',
      'Event',
      'Unknown',
    ]);
    expect(categoryLabel('skill-gain')).toBe('Skill gain');
  });
});

describe('predicate - sections', () => {
  it('the pristine filter keeps every job', () => {
    expect(count({})).toBe(371);
  });

  it('faction: OR inside the section', () => {
    expect(count({ factions: new Set(['rep_mschf']) })).toBe(72);
    expect(count({ factions: new Set(['rep_mschf', 'rep_pearl']) })).toBe(72 + 69);
  });

  it('pickup place: a whole astro or a single zone', () => {
    expect(count({ place: 'ast:506' })).toBe(34);
    expect(count({ place: 'zone:506:55' })).toBe(6);
    expect(count({ place: 'garbage' })).toBe(0);
  });

  it('category and reward: OR inside the section', () => {
    expect(count({ categories: new Set(['beginner', 'event']) })).toBe(24 + 5);
    expect(count({ rewards: new Set(['coin']) })).toBe(310);
    expect(count({ rewards: new Set(['coin', 'rocks']) })).toBe(334);
  });

  it('AND across sections', () => {
    expect(count({ factions: new Set(['rep_mschf']), noRepOnly: true })).toBe(32);
    const both = { factions: new Set(['rep_mschf']), rewards: new Set(['coin']) };
    const out = visibleJobs(jobs, { ...pristineFilter(), ...both }, EMPTY_CONTEXT);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((j) => j.factionRep === 'rep_mschf' && j.reward === 'coin')).toBe(true);
  });

  it('skill: any / no skill needed / exact', () => {
    expect(count({ skill: null })).toBe(371);
    expect(count({ skill: NONE })).toBe(187);
    expect(count({ skill: 'stealth' })).toBe(27);
  });

  it('shire: a shire keeps the open-to-all jobs plus its own; NONE keeps open-to-all only', () => {
    expect(count({ shire: 'NorthSquire' })).toBe(196 + 26);
    expect(count({ shire: 'EastSquire' })).toBe(196 + 67);
    expect(count({ shire: NONE })).toBe(196);
  });

  it('no reputation needed', () => {
    expect(count({ noRepOnly: true })).toBe(169);
  });

  it("don't anger excludes the rival's jobs and keeps rival-less ones", () => {
    expect(count({ avoidRivals: new Set(['rep_mrtn']) })).toBe(321);
    const kept = visibleJobs(jobs, { ...pristineFilter(), avoidRivals: new Set(['rep_mrtn', 'rep_chat']) }, EMPTY_CONTEXT);
    expect(kept.length).toBe(371 - 50 - 37);
    expect(kept.some((j) => j.factionRival === null)).toBe(true);
    expect(kept.every((j) => j.factionRival !== 'rep_mrtn' && j.factionRival !== 'rep_chat')).toBe(true);
  });

  it('no prerequisites = 21 jobs in the shipped data', () => {
    expect(count({ noPrereqOnly: true })).toBe(21);
    expect(jobs.filter(hasNoPrerequisite).length).toBe(21);
  });

  it('companion filters read favorites and statuses from the context', () => {
    const ctx: JobContext = {
      starred: new Set(['35511202']),
      statusMap: new Map<string, JobStatusValue>([['35511202', 'done']]),
    };
    expect(count({ starredOnly: true }, ctx)).toBe(1);
    expect(count({ statuses: new Set<JobStatusValue>(['done']) }, ctx)).toBe(1);
    expect(count({ statuses: new Set<JobStatusValue>(['todo']) }, ctx)).toBe(370);
    expect(count({ statuses: new Set<JobStatusValue>(['todo', 'done']) }, ctx)).toBe(371);
    expect(count({ statuses: new Set<JobStatusValue>(['in_progress']) }, ctx)).toBe(0);
  });
});

describe('search', () => {
  it('parses: trim, lowercase, leading # dropped, split into words', () => {
    expect(parseQuery('  #35511202 ')).toEqual(['35511202']);
    expect(parseQuery('Queens   QUARRY')).toEqual(['queens', 'quarry']);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('finds a job by #ID or bare ID', () => {
    expect(ids({ query: '#35511202' })).toEqual([35511202]);
    expect(ids({ query: '35511202' })).toEqual([35511202]);
    expect(ids({ query: '  35511202  ' })).toEqual([35511202]);
  });

  it('matches faction names', () => {
    const found = new Set(ids({ query: 'mischief' }));
    const mischief = jobs.filter((j) => j.factionRep === 'rep_mschf');
    expect(mischief.length).toBe(72);
    expect(mischief.every((j) => found.has(j.id))).toBe(true);
  });

  it('matches place names (pickup or dropoff), every word required', () => {
    const found = visibleJobs(jobs, { ...pristineFilter(), query: 'Queens Quarry' }, EMPTY_CONTEXT);
    const named = jobs.filter(
      (j) => j.dropoffLocation.name === 'Queens Quarry' || j.pickupLocation.name === 'Queens Quarry',
    );
    expect(named.length).toBe(24);
    const foundIds = new Set(found.map((j) => j.id));
    expect(named.every((j) => foundIds.has(j.id))).toBe(true);
    // Every hit carries both words somewhere (names, description, ...).
    expect(found.every((j) => /queens/i.test(jobHaystack(j)) && /quarry/i.test(jobHaystack(j)))).toBe(true);
    // Multi-word AND: each word narrows.
    expect(count({ query: 'mischief coin' })).toBeLessThanOrEqual(count({ query: 'mischief' }));
    expect(count({ query: 'queens zzzz-not-there' })).toBe(0);
  });

  it('matches categories, rewards, skills and shires', () => {
    expect(count({ query: 'beginner' })).toBeGreaterThanOrEqual(24);
    expect(count({ query: 'titanium' })).toBeGreaterThanOrEqual(4);
    expect(count({ query: 'north squire' })).toBeGreaterThanOrEqual(26);
    expect(count({ query: 'carry coin' })).toBeGreaterThanOrEqual(7);
  });

  it("matches the name the place picker gives a job's zone (with the dataset's zone names)", () => {
    const ctx: JobContext = { ...EMPTY_CONTEXT, zoneNames: buildPlaces(jobs).zoneNames };
    const found = (query: string) =>
      new Set(visibleJobs(jobs, { ...pristineFilter(), query }, ctx).map((j) => j.id));
    expect(jobById(50605703).pickupLocation.name).toBe('Docking Bay'); // filed under "Docking Port"
    expect(found('docking port').has(50605703)).toBe(true);
    expect(jobById(35511201).pickupLocation.name).toBe('Upshire'); // filed under "Northshire" (z56)
    expect(found('northshire').has(35511201)).toBe(true);
    // Without the table only the job's own names match.
    expect(ids({ query: 'docking port' })).not.toContain(50605703);
  });
});

describe('sorts', () => {
  it('exposes 6 sorts with labels, idAsc first', () => {
    expect(JOB_SORTS.map((s) => s.value)).toEqual(['idAsc', 'bonusDesc', 'bonusAsc', 'riskAsc', 'riskDesc', 'repAsc']);
    expect(sortLabel('repAsc')).toBe('Reputation needed ↑');
    expect(sortLabel('riskDesc')).toBe('Risk ↓');
  });

  it('visibleJobs applies the chosen sort', () => {
    const out = visibleJobs(jobs, { ...pristineFilter(), sort: 'bonusDesc' }, EMPTY_CONTEXT);
    expect(out.length).toBe(371);
    for (let i = 1; i < out.length; i++) expect(out[i - 1]!.bonus).toBeGreaterThanOrEqual(out[i]!.bonus);
    const rep = visibleJobs(jobs, { ...pristineFilter(), sort: 'repAsc' }, EMPTY_CONTEXT);
    for (let i = 1; i < rep.length; i++) expect(rep[i - 1]!.requiredRep).toBeLessThanOrEqual(rep[i]!.requiredRep);
  });
});

describe('badge, resets, equality', () => {
  const busy = (): JobFilter => ({
    ...pristineFilter(),
    query: 'coin',
    factions: new Set(['rep_mschf']),
    place: 'ast:355',
    categories: new Set(['beginner']),
    rewards: new Set(['coin']),
    skill: 'stealth',
    shire: 'NorthSquire',
    noRepOnly: true,
    avoidRivals: new Set(['rep_mrtn']),
    noPrereqOnly: true,
    starredOnly: true,
    statuses: new Set<JobStatusValue>(['todo']),
    sort: 'riskDesc',
  });

  it('counts active sheet sections only (Requirements once)', () => {
    expect(activeSectionCount(pristineFilter())).toBe(0);
    expect(activeSectionCount(busy())).toBe(6);
    expect(activeSectionCount({ ...pristineFilter(), skill: NONE, noRepOnly: true })).toBe(1);
    expect(activeSectionCount({ ...pristineFilter(), query: 'x', starredOnly: true, noPrereqOnly: true })).toBe(0);
  });

  it("the sheet's Reset clears the six sections and nothing else", () => {
    const after = resetSheetSections(busy());
    expect(activeSectionCount(after)).toBe(0);
    expect(after.query).toBe('coin');
    expect(after.starredOnly).toBe(true);
    expect(after.noPrereqOnly).toBe(true);
    expect([...after.statuses]).toEqual(['todo']);
    expect(after.sort).toBe('riskDesc');
  });

  it('the empty-state reset clears everything but the sort', () => {
    const after = resetAllFilters(busy());
    expect(filtersEqual(after, { ...pristineFilter(), sort: 'riskDesc' })).toBe(true);
    expect(hasAnyCriteria(after)).toBe(false);
    expect(hasAnyCriteria({ ...pristineFilter(), query: '  ' })).toBe(false);
    expect(hasAnyCriteria({ ...pristineFilter(), starredOnly: true })).toBe(true);
  });

  it('compares sets by content', () => {
    expect(filtersEqual(busy(), busy())).toBe(true);
    expect(filtersEqual(busy(), { ...busy(), factions: new Set(['rep_hex']) })).toBe(false);
  });
});

describe('activeFilterChips', () => {
  const places = buildPlaces(jobs);

  it('one readable chip per sheet criterion; search and quick filters excluded', () => {
    const f: JobFilter = {
      ...pristineFilter(),
      query: 'ignored',
      starredOnly: true,
      noPrereqOnly: true,
      factions: new Set(['rep_mschf']),
      place: 'zone:506:55',
      categories: new Set(['skill-gain']),
      rewards: new Set(['data']),
      skill: 'stealth',
      shire: 'NorthSquire',
      noRepOnly: true,
      avoidRivals: new Set(['rep_mrtn']),
    };
    expect(activeFilterChips(f, places).map((c) => c.label)).toEqual([
      'Mischief',
      'From: Docking Port, Astro 506',
      'Skill gain',
      'Reward: Map Data',
      'Skill: Stealth',
      'Shire: North Squire',
      'No reputation needed',
      "Don't anger Martian",
    ]);
  });

  it('labels the NONE choices and whole-astro places', () => {
    const f: JobFilter = { ...pristineFilter(), skill: NONE, shire: NONE, place: 'ast:301' };
    expect(activeFilterChips(f, places).map((c) => c.label)).toEqual([
      'From: Luna · 301',
      'No skill needed',
      'Open to all only',
    ]);
  });

  it('exposes pure removers', () => {
    const f: JobFilter = { ...pristineFilter(), factions: new Set(['rep_mschf', 'rep_hex']), noRepOnly: true };
    const afterRemove = activeFilterChips(f, places)[0]!.remove(f);
    expect([...afterRemove.factions]).toEqual(['rep_hex']);
    expect(afterRemove.noRepOnly).toBe(true);
    expect([...f.factions]).toEqual(['rep_mschf', 'rep_hex']); // untouched
  });
});
