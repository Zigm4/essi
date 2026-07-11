// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { canonicalReward, coordsLabel, locationLabel, parseJobsJson, type Job } from './jobModel';
import {
  accepts,
  acceptsCompanion,
  activeCount,
  activeFilterChips,
  bonusExtent,
  JOB_SORTS,
  pristineFilter,
  sortLabel,
  visibleJobs,
  type JobFilter,
} from './jobsLogic';
import { computeFacets } from './jobsFacets';
import { typeBucket } from './jobTaxonomies';

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
    expect(first.hasRival).toBe(false);
    expect(first.isPlaceholderType).toBe(false);
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

describe('bonusExtent', () => {
  it('matches the shipped data extent (−2740 … 500)', () => {
    expect(bonusExtent(jobs)).toEqual([-2740, 500]);
  });
  it('handles empty and degenerate inputs', () => {
    expect(bonusExtent([])).toEqual([0, 1]);
  });
});

describe('accepts', () => {
  const base = (): JobFilter => ({ ...pristineFilter(), bonus: [-2740, 500], bonusMin: -2740, bonusMax: 500 });

  it('an empty filter accepts every job', () => {
    expect(jobs.every((j) => accepts(base(), j))).toBe(true);
  });

  it('query searches description / on-complete / id / typeRaw', () => {
    const f = { ...base(), query: '35511202' };
    expect(jobs.filter((j) => accepts(f, j)).map((j) => j.id)).toContain(35511202);
  });

  it('type set matches the canonical (lowercased) type', () => {
    const f = { ...base(), types: new Set(['beginner']) };
    expect(jobs.filter((j) => accepts(f, j)).every((j) => j.type === 'beginner')).toBe(true);
  });

  it('allied faction requires a non-null match', () => {
    const f = { ...base(), alliedFactions: new Set(['rep_proq']) };
    const out = jobs.filter((j) => accepts(f, j));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((j) => j.factionRep === 'rep_proq')).toBe(true);
  });

  it('risk range is inclusive', () => {
    const f = { ...base(), risk: [0, 0] as [number, number] };
    expect(jobs.filter((j) => accepts(f, j)).every((j) => j.risk === 0)).toBe(true);
  });

  it('hidePlaceholder drops ??? jobs, cargoOnly keeps capacity>0', () => {
    const hide = { ...base(), hidePlaceholder: true };
    expect(jobs.filter((j) => accepts(hide, j)).some((j) => j.isPlaceholderType)).toBe(false);
    const cargo = { ...base(), cargoJobsOnly: true };
    expect(jobs.filter((j) => accepts(cargo, j)).every((j) => j.isCargoJob)).toBe(true);
  });

  it('pickup location filters by astnum/zone equality', () => {
    const f = { ...base(), pickupAstnum: 355, pickupZone: 35 };
    expect(
      jobs.filter((j) => accepts(f, j)).every((j) => j.pickupLocation.astnum === 355 && j.pickupLocation.zone === 35),
    ).toBe(true);
  });
});

describe('acceptsCompanion', () => {
  it('starredOnly and status membership', () => {
    const f = { ...pristineFilter(), starredOnly: true };
    expect(acceptsCompanion(f, true, 'todo')).toBe(true);
    expect(acceptsCompanion(f, false, 'todo')).toBe(false);
    const g: JobFilter = { ...pristineFilter(), statuses: new Set<JobStatusValue>(['done']) };
    expect(acceptsCompanion(g, false, 'done')).toBe(true);
    expect(acceptsCompanion(g, false, 'todo')).toBe(false);
  });
});

describe('activeCount', () => {
  it('is 0 for the pristine filter', () => {
    expect(activeCount(pristineFilter())).toBe(0);
  });
  it('counts sets, narrowed ranges, locations, booleans, and statuses once', () => {
    const f: JobFilter = {
      ...pristineFilter(),
      query: 'x',
      types: new Set(['beginner']),
      risk: [2, 10],
      pickupAstnum: 355,
      onSiteOnly: true,
      statuses: new Set<JobStatusValue>(['todo', 'done']),
    };
    // query(1) + types(1) + risk(1) + pickupAst(1) + onSite(1) + statuses(1) = 6
    expect(activeCount(f)).toBe(6);
  });
  it('bonus counts only when strictly inside the extent', () => {
    const inside: JobFilter = { ...pristineFilter(), bonus: [-2000, 500], bonusMin: -2740, bonusMax: 500 };
    expect(activeCount(inside)).toBe(1);
    const full: JobFilter = { ...pristineFilter(), bonus: [-2740, 500], bonusMin: -2740, bonusMax: 500 };
    expect(activeCount(full)).toBe(0);
  });
});

describe('activeFilterChips', () => {
  it('excludes query and companion filters, exposes pure removers', () => {
    const f: JobFilter = {
      ...pristineFilter(),
      query: 'ignored',
      starredOnly: true,
      types: new Set(['beginner']),
      risk: [3, 9],
    };
    const chips = activeFilterChips(f);
    expect(chips.map((c) => c.id)).toEqual(['type:beginner', 'risk']);
    const afterRemove = chips[1]!.remove(f);
    expect(afterRemove.risk).toEqual([0, 14]);
    expect(afterRemove.types.has('beginner')).toBe(true); // untouched
  });

  it('formats the range and location chip labels', () => {
    const f: JobFilter = {
      ...pristineFilter(),
      skillAmt: [10, 50],
      bonus: [-2000, 400],
      bonusMin: -2740,
      bonusMax: 500,
      pickupZone: 35,
    };
    const labels = activeFilterChips(f).map((c) => c.label);
    expect(labels).toContain('skill ≥10..50');
    expect(labels).toContain('bonus -2000..400');
    expect(labels).toContain('pickup z35');
  });
});

describe('sorts', () => {
  it('exposes 7 sorts with labels', () => {
    expect(JOB_SORTS.map((s) => s.value)).toEqual([
      'idAsc',
      'riskAsc',
      'riskDesc',
      'bonusDesc',
      'bonusAsc',
      'skillAmtDesc',
      'skillAmtAsc',
    ]);
    expect(sortLabel('riskDesc')).toBe('Risk ↓');
  });

  it('visibleJobs applies the chosen sort', () => {
    const f: JobFilter = { ...pristineFilter(), sort: 'bonusDesc' };
    const out = visibleJobs(jobs, f, new Set(), new Map());
    expect(out.length).toBe(371);
    for (let i = 1; i < out.length; i++) expect(out[i - 1]!.bonus).toBeGreaterThanOrEqual(out[i]!.bonus);
  });

  it('visibleJobs honours companion filters', () => {
    const f: JobFilter = { ...pristineFilter(), starredOnly: true };
    const starred = new Set([String(jobs[0]!.id)]);
    const out = visibleJobs(jobs, f, starred, new Map());
    expect(out.every((j) => starred.has(String(j.id)))).toBe(true);
  });
});

describe('computeFacets', () => {
  it('buckets types and counts rewards/skills present in the data', () => {
    const facets = computeFacets(jobs);
    expect(facets.bonusMin).toBe(-2740);
    expect(facets.bonusMax).toBe(500);
    // Buckets appear alphabetically and only when present.
    const buckets = facets.typeGroups.map((g) => g.bucket);
    expect(buckets).toEqual([...buckets].sort());
    // Every counted type maps to its declared bucket.
    for (const group of facets.typeGroups) {
      for (const t of group.types) expect(typeBucket(t.key)).toBe(group.bucket);
    }
    const rewardKeys = facets.rewards.map((r) => r.key);
    expect(rewardKeys).toContain('rocks');
    expect(facets.rewards.every((r) => r.count > 0)).toBe(true);
  });
});
