// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { parseJobsJson } from './jobModel';
import { computeFacetCounts, computeFacetOptions, countOf, rankByCount, sanitizeFilter } from './jobsFacets';
import {
  countMatching,
  EMPTY_CONTEXT,
  NONE,
  pristineFilter,
  visibleJobs,
  type JobContext,
  type JobFilter,
} from './jobsLogic';

const jobs = parseJobsJson(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/catalog/jobs.json', import.meta.url)), 'utf-8'),
  ),
);
const options = computeFacetOptions(jobs);

function filterOf(partial: Partial<JobFilter>): JobFilter {
  return { ...pristineFilter(), ...partial };
}

function withMember(set: ReadonlySet<string>, key: string): Set<string> {
  return new Set([...set, key]);
}

function withoutMember(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  next.delete(key);
  return next;
}

describe('computeFacetOptions', () => {
  it('offers only the values present in the data', () => {
    expect(options.factions.length).toBe(15);
    expect(options.rivals.length).toBe(12);
    expect(options.skills.length).toBe(17);
    expect(options.shires).toEqual(['DownSquire', 'EastSquire', 'NorthSquire', 'SouthSquire', 'UpSquire', 'WestSquire']);
    expect(options.categories).toEqual(['beginner', 'skill-gain', 'standard', 'expansion', 'event', 'unknown']);
    expect(options.rewards).toContain('coin');
    expect(options.rewards).not.toContain('scrp');
  });
});

describe('computeFacetCounts at rest', () => {
  const counts = computeFacetCounts(jobs, pristineFilter(), EMPTY_CONTEXT);

  it('matches the dataset totals', () => {
    expect(counts.total).toBe(371);
    expect(countOf(counts.factions, 'rep_mschf')).toBe(72);
    expect(countOf(counts.factions, 'rep_pearl')).toBe(69);
    expect(countOf(counts.rewards, 'coin')).toBe(310);
    expect(countOf(counts.rewards, 'scrap')).toBe(15);
    expect(countOf(counts.categories, 'skill-gain')).toBe(113);
    expect(counts.placeAny).toBe(371);
    expect(countOf(counts.places, 'ast:355')).toBe(55);
    expect(countOf(counts.places, 'zone:506:55')).toBe(6);
    expect(counts.skillAny).toBe(371);
    expect(countOf(counts.skills, NONE)).toBe(187);
    expect(countOf(counts.skills, 'stealth')).toBe(27);
    expect(countOf(counts.shires, NONE)).toBe(196);
    expect(countOf(counts.shires, 'NorthSquire')).toBe(222);
    expect(countOf(counts.shires, 'SouthSquire')).toBe(200);
    expect(counts.noRep).toBe(169);
    expect(countOf(counts.avoidRivals, 'rep_mrtn')).toBe(50);
    expect(counts.noPrereq).toBe(21);
  });

  it('ranks chips by count, then label', () => {
    const ranked = rankByCount(options.factions, counts.factions, (k) => k);
    expect(ranked.slice(0, 3)).toEqual(['rep_mschf', 'rep_pearl', 'rep_proq']);
    expect(rankByCount(['b', 'a'], new Map([['a', 1], ['b', 1]]), (k) => k)).toEqual(['a', 'b']);
  });
});

/** Asserts every displayed count equals what the list shows once that value is picked. */
function checkCountsAgainstPredicate(filter: JobFilter, ctx: JobContext) {
  const counts = computeFacetCounts(jobs, filter, ctx);
  const n = (f: JobFilter) => countMatching(jobs, f, ctx);
  const current = n(filter);

  expect(counts.total).toBe(current);
  expect(counts.total).toBe(visibleJobs(jobs, filter, ctx).length);

  const multi = [
    ['factions', options.factions, counts.factions],
    ['categories', options.categories, counts.categories],
    ['rewards', options.rewards, counts.rewards],
  ] as const;
  for (const [field, values, map] of multi) {
    const selected = filter[field];
    for (const v of values) {
      // The value's own share of the list (what it lists alone in its section)...
      expect(countOf(map, v)).toBe(n({ ...filter, [field]: new Set([v]) }));
      // ...which is exactly what picking it adds to an existing selection.
      if (!selected.has(v)) {
        expect(n({ ...filter, [field]: withMember(selected, v) }) - (selected.size > 0 ? current : 0)).toBe(countOf(map, v));
      }
    }
  }

  expect(counts.placeAny).toBe(n({ ...filter, place: null }));
  for (const astro of options.places.astros) {
    expect(countOf(counts.places, astro.key)).toBe(n({ ...filter, place: astro.key }));
    for (const zone of astro.zones) expect(countOf(counts.places, zone.key)).toBe(n({ ...filter, place: zone.key }));
  }

  expect(counts.skillAny).toBe(n({ ...filter, skill: null }));
  for (const v of [NONE, ...options.skills]) expect(countOf(counts.skills, v)).toBe(n({ ...filter, skill: v }));
  expect(counts.shireAny).toBe(n({ ...filter, shire: null }));
  for (const v of [NONE, ...options.shires]) expect(countOf(counts.shires, v)).toBe(n({ ...filter, shire: v }));

  expect(counts.noRep).toBe(n({ ...filter, noRepOnly: true }));
  expect(counts.noPrereq).toBe(n({ ...filter, noPrereqOnly: true }));

  // Don't anger: the jobs that choice hides.
  for (const r of options.rivals) {
    const shown = n({ ...filter, avoidRivals: withoutMember(filter.avoidRivals, r) });
    const hidden = n({ ...filter, avoidRivals: withMember(filter.avoidRivals, r) });
    expect(countOf(counts.avoidRivals, r)).toBe(shown - hidden);
  }
}

describe('contextual counts equal the real result of picking the value', () => {
  const ctx: JobContext = {
    starred: new Set(jobs.filter((j) => j.id % 3 === 0).map((j) => String(j.id))),
    statusMap: new Map<string, JobStatusValue>(
      jobs.filter((j) => j.id % 4 === 0).map((j) => [String(j.id), j.id % 8 === 0 ? 'done' : 'in_progress']),
    ),
  };

  const combos: [string, Partial<JobFilter>, JobContext][] = [
    ['pristine', {}, EMPTY_CONTEXT],
    ['one faction', { factions: new Set(['rep_mschf']) }, EMPTY_CONTEXT],
    ['two factions + reward', { factions: new Set(['rep_mschf', 'rep_hex']), rewards: new Set(['coin']) }, EMPTY_CONTEXT],
    ['place + category', { place: 'ast:355', categories: new Set(['beginner', 'standard']) }, EMPTY_CONTEXT],
    ['requirements', { skill: NONE, shire: 'NorthSquire', noRepOnly: true }, EMPTY_CONTEXT],
    ['exact skill + avoid', { skill: 'stealth', avoidRivals: new Set(['rep_mrtn', 'rep_chat']) }, EMPTY_CONTEXT],
    ['search + quick', { query: 'coin', noPrereqOnly: true }, EMPTY_CONTEXT],
    [
      'everything + favorites/statuses',
      {
        factions: new Set(['rep_pearl', 'rep_proq']),
        place: 'zone:506:53',
        shire: NONE,
        avoidRivals: new Set(['rep_qnxs']),
        starredOnly: true,
        statuses: new Set<JobStatusValue>(['todo', 'done']),
      },
      ctx,
    ],
    ['statuses only', { statuses: new Set<JobStatusValue>(['in_progress']) }, ctx],
  ];

  for (const [name, partial, context] of combos) {
    it(name, () => checkCountsAgainstPredicate(filterOf(partial), context));
  }

  it("Don't anger Martian at rest hides exactly 50 jobs (321 left)", () => {
    const counts = computeFacetCounts(jobs, pristineFilter(), EMPTY_CONTEXT);
    expect(countOf(counts.avoidRivals, 'rep_mrtn')).toBe(50);
    expect(countMatching(jobs, filterOf({ avoidRivals: new Set(['rep_mrtn']) }), EMPTY_CONTEXT)).toBe(321);
  });
});

describe('sanitizeFilter', () => {
  it('drops values absent from the data and keeps the rest', () => {
    const dirty = filterOf({
      factions: new Set(['rep_mschf', 'rep_nope']),
      place: 'ast:999999',
      categories: new Set(['beginner', 'bogus']),
      rewards: new Set(['coin', 'gold bars']),
      skill: 'juggling',
      shire: NONE,
      avoidRivals: new Set(['rep_mrtn', 'rep_nope']),
      starredOnly: true,
    });
    const clean = sanitizeFilter(dirty, options);
    expect([...clean.factions]).toEqual(['rep_mschf']);
    expect(clean.place).toBeNull();
    expect([...clean.categories]).toEqual(['beginner']);
    expect([...clean.rewards]).toEqual(['coin']);
    expect(clean.skill).toBeNull();
    expect(clean.shire).toBe(NONE);
    expect([...clean.avoidRivals]).toEqual(['rep_mrtn']);
    expect(clean.starredOnly).toBe(true);
  });

  it('returns the same object when everything is known', () => {
    const ok = filterOf({ factions: new Set(['rep_mschf']), place: 'zone:506:55', skill: 'stealth' });
    expect(sanitizeFilter(ok, options)).toBe(ok);
  });
});
