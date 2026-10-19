// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { canonicalReward, coordsLabel, locationLabel, parseJob, parseJobsJson, secondFactionEffect, type Job } from './jobModel';
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
import { categoryLabel, factionInfo, jobCategory, JOB_CATEGORIES, skillLabel } from './jobTaxonomies';

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

  it("derives the second faction's effect from rivalFunction (add = also gains, remove = loses)", () => {
    const harmed: Record<string, number> = {};
    for (const job of jobs) if (job.harmedFaction !== null) harmed[job.harmedFaction] = (harmed[job.harmedFaction] ?? 0) + 1;
    expect(harmed).toEqual({
      rep_mrtn: 17,
      rep_lycnx: 17,
      rep_qnxs: 3,
      rep_rsa: 3,
      rep_king: 2,
      rep_55imp: 1,
      rep_uurt: 1,
      rep_chat: 1,
      rep_rvnts: 1,
      rep_oort: 1,
    });
    expect(jobs.filter((j) => j.alsoGainsFaction !== null).length).toBe(283);
    expect(jobs.some((j) => j.harmedFaction !== null && j.alsoGainsFaction !== null)).toBe(false);
    // The stem names the faction when factionRival is missing; setStaminaAmt touches none.
    expect(secondFactionEffect('removeRsaAmt', null)).toEqual({ harmed: 'rep_rsa', gains: null });
    expect(secondFactionEffect('remove55ImpAmt', null)).toEqual({ harmed: 'rep_55imp', gains: null });
    expect(secondFactionEffect('addCo8Amt', 'rep_co8')).toEqual({ harmed: null, gains: 'rep_co8' });
    expect(secondFactionEffect('setStaminaAmt', null)).toEqual({ harmed: null, gains: null });
    expect(secondFactionEffect(null, 'rep_mrtn')).toEqual({ harmed: null, gains: null });
    // A faction the data names as rival can also gain: Martian is rival on 50 jobs, harmed on 17.
    expect(jobs.filter((j) => j.factionRival === 'rep_mrtn' && j.alsoGainsFaction === 'rep_mrtn').length).toBe(33);
  });

  it('parses the required equipment and its description note', () => {
    const job = jobById(40022001);
    expect(job.requiredRep).toBe(5);
    expect(job.factionRep).toBe('rep_rts');
    expect(job.requiredAsset).toEqual({ template: 'up.tech', id: '874023', note: 'Space Camera required' });
    expect(jobById(40021101).requiredAsset).toEqual({ template: 'up.tech', id: '874023', note: null });
    // The key is present on 15 rows but set on 11 (10 ids: 30107301 is duplicated).
    expect(jobs.filter((j) => j.requiredAsset !== null).length).toBe(11);
    expect(jobById(35511202).requiredAsset).toBeNull();
    const numeric = parseJob({
      id: 9,
      requiredAssetId: 42,
      pickupLocation: { astnum: 1, zone: 2 },
      dropoffLocation: { astnum: 1, zone: 2 },
    });
    expect(numeric?.requiredAsset).toEqual({ template: null, id: '42', note: null });
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

describe('faction labels', () => {
  it('show the attested name, else the code', () => {
    expect(factionInfo('rep_rts')).toMatchObject({ code: 'RTS', name: 'Rustwind', label: 'Rustwind', fullLabel: 'Rustwind (RTS)' });
    expect(factionInfo('rep_proq')).toMatchObject({ code: 'PRQ', name: null, label: 'PRQ', fullLabel: 'PRQ' });
    expect(factionInfo('rep_mschn').label).toBe('MSN');
    expect(factionInfo('rep_55imp').label).toBe('55th');
    expect(factionInfo('rep_co8').label).toBe('CO8');
    expect(factionInfo('rep_rvnts').fullLabel).toBe('Revenants (PRV)');
    expect(factionInfo('rep_uurt').label).toBe('Uurtians');
    expect(factionInfo('rep_unknown')).toMatchObject({ code: 'rep_unknown', label: 'rep_unknown' });
  });

  it('cover every faction key in the data', () => {
    const keys = new Set(jobs.flatMap((j) => [j.factionRep, j.factionRival, j.harmedFaction]).filter((k) => k !== null));
    for (const key of keys) expect(factionInfo(key!).code).not.toBe(key);
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

  it("don't anger excludes only the jobs that make the faction lose reputation", () => {
    expect(count({ avoidRivals: new Set(['rep_mrtn']) })).toBe(354);
    const kept = visibleJobs(jobs, { ...pristineFilter(), avoidRivals: new Set(['rep_mrtn', 'rep_chat']) }, EMPTY_CONTEXT);
    expect(kept.length).toBe(371 - 17 - 1);
    expect(kept.some((j) => j.harmedFaction === null)).toBe(true);
    expect(kept.every((j) => j.harmedFaction !== 'rep_mrtn' && j.harmedFaction !== 'rep_chat')).toBe(true);
    // Jobs where Martian also gains are kept.
    expect(kept.some((j) => j.alsoGainsFaction === 'rep_mrtn')).toBe(true);
  });

  it('no prerequisites = 21 jobs in the shipped data (no reputation, skill, shire or equipment)', () => {
    expect(count({ noPrereqOnly: true })).toBe(21);
    expect(jobs.filter(hasNoPrerequisite).length).toBe(21);
    // Every equipment job also needs a skill today, so the count is unchanged - but equipment alone excludes.
    const free = jobs.find(hasNoPrerequisite)!;
    expect(hasNoPrerequisite({ ...free, requiredAsset: { template: 'up.tech', id: '874023', note: null } })).toBe(false);
    expect(jobs.filter((j) => j.requiredAsset !== null).every((j) => !hasNoPrerequisite(j))).toBe(true);
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

  it('matches faction names and codes', () => {
    const found = new Set(ids({ query: 'mischief' }));
    const mischief = jobs.filter((j) => j.factionRep === 'rep_mschf');
    expect(mischief.length).toBe(72);
    expect(mischief.every((j) => found.has(j.id))).toBe(true);
    const byCode = new Set(ids({ query: 'msc' }));
    expect(mischief.every((j) => byCode.has(j.id))).toBe(true);
    const prq = new Set(ids({ query: 'PRQ' }));
    expect(jobs.filter((j) => j.factionRep === 'rep_proq').every((j) => prq.has(j.id))).toBe(true);
    expect(count({ query: 'rustwind' })).toBeGreaterThanOrEqual(10);
    // Made-up names are gone.
    expect(count({ query: 'proquinox' })).toBe(0);
    expect(count({ query: 'mischen' })).toBe(0);
  });

  it('matches the equipment', () => {
    expect(ids({ query: 'space camera' })).toEqual([40022001]);
    expect(count({ query: 'up.tech' })).toBe(9);
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

  it("matches the owner's zone names and the name the place picker gives a job's zone", () => {
    // Owner's names (ZONE_LABELS / ASTNUM_LABELS) are always searchable.
    expect(jobById(50605703).pickupLocation.name).toBe('Docking Bay');
    expect(ids({ query: 'docking port' })).toContain(50605703);
    expect(ids({ query: 'jupiter station' })).toContain(50605703);
    expect(count({ query: "queen's quarry" })).toBeGreaterThanOrEqual(24);
    // The picker's name for a zone the owner hasn't named needs the dataset's table.
    const ctx: JobContext = { ...EMPTY_CONTEXT, zoneNames: buildPlaces(jobs).zoneNames };
    const found = (query: string) =>
      new Set(visibleJobs(jobs, { ...pristineFilter(), query }, ctx).map((j) => j.id));
    expect(jobById(35511201).pickupLocation.name).toBe('Upshire'); // filed under "Northshire" (z56)
    expect(found('northshire').has(35511201)).toBe(true);
    expect(ids({ query: 'northshire' })).not.toContain(35511201);
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
      'From: Jupiter Station · Docking Port',
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

  it('names factions by attested name or code', () => {
    const f: JobFilter = { ...pristineFilter(), factions: new Set(['rep_proq']), avoidRivals: new Set(['rep_55imp']) };
    expect(activeFilterChips(f, places).map((c) => c.label)).toEqual(['PRQ', "Don't anger 55th"]);
  });

  it('exposes pure removers', () => {
    const f: JobFilter = { ...pristineFilter(), factions: new Set(['rep_mschf', 'rep_hex']), noRepOnly: true };
    const afterRemove = activeFilterChips(f, places)[0]!.remove(f);
    expect([...afterRemove.factions]).toEqual(['rep_hex']);
    expect(afterRemove.noRepOnly).toBe(true);
    expect([...f.factions]).toEqual(['rep_mschf', 'rep_hex']); // untouched
  });
});
