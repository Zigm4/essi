// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobStatusValue } from '../../../data/db';
import { parseJobsJson } from './jobModel';
import { computeFacetOptions } from './jobsFacets';
import { countMatching, EMPTY_CONTEXT, filtersEqual, NONE, pristineFilter, type JobFilter } from './jobsLogic';
import { decodeJobsSearch, encodeJobsSearch } from './jobsUrl';

const jobs = parseJobsJson(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/catalog/jobs.json', import.meta.url)), 'utf-8'),
  ),
);
const options = computeFacetOptions(jobs);

const full: JobFilter = {
  ...pristineFilter(),
  factions: new Set(['rep_pearl', 'rep_mschf']),
  categories: new Set(['beginner']),
  place: 'ast:355',
  rewards: new Set(['coin']),
  skill: 'stealth',
  shire: 'EastSquire',
  noRepOnly: true,
  avoidRivals: new Set(['rep_mrtn']),
  query: 'texte',
  sort: 'bonusDesc',
};

describe('encodeJobsSearch', () => {
  it('is empty for the pristine filter', () => {
    expect(encodeJobsSearch(pristineFilter())).toBe('');
  });

  it('writes short, readable, sorted parameters', () => {
    expect(encodeJobsSearch(full)).toBe(
      '?f=rep_mschf,rep_pearl&cat=beginner&p=ast:355&r=coin&sk=stealth&sh=EastSquire&norep=1&avoid=rep_mrtn&q=texte&sort=bonusDesc',
    );
  });

  it('never carries favorites, statuses or No prerequisites', () => {
    const personal: JobFilter = {
      ...pristineFilter(),
      starredOnly: true,
      noPrereqOnly: true,
      statuses: new Set<JobStatusValue>(['done']),
    };
    expect(encodeJobsSearch(personal)).toBe('');
  });
});

describe('decodeJobsSearch', () => {
  it('round-trips', () => {
    for (const f of [
      full,
      { ...pristineFilter(), skill: NONE, shire: NONE, place: 'zone:506:55' },
      { ...pristineFilter(), query: 'a&b=c, d #35511202' },
    ]) {
      const shared = decodeJobsSearch(encodeJobsSearch(f), options);
      expect(shared).not.toBeNull();
      expect(filtersEqual({ ...pristineFilter(), ...shared }, f)).toBe(true);
    }
  });

  it('returns null without any jobs parameter', () => {
    expect(decodeJobsSearch('')).toBeNull();
    expect(decodeJobsSearch('?utm=1')).toBeNull();
  });

  it('fills the fields a link leaves out with their pristine value', () => {
    const shared = decodeJobsSearch('?norep=1', options)!;
    expect(shared.noRepOnly).toBe(true);
    expect(shared.factions.size).toBe(0);
    expect(shared.sort).toBe('idAsc');
    expect(shared.query).toBe('');
  });

  it('ignores unknown and malformed values without throwing', () => {
    const shared = decodeJobsSearch(
      '?f=rep_nope,rep_mschf,,&cat=bogus,event&p=ast:999999&r=gold&sk=juggling&sh=MoonSquire&avoid=rep_x&sort=sideways&norep=yes',
      options,
    )!;
    expect([...shared.factions]).toEqual(['rep_mschf']);
    expect([...shared.categories]).toEqual(['event']);
    expect(shared.place).toBeNull();
    expect(shared.rewards.size).toBe(0);
    expect(shared.skill).toBeNull();
    expect(shared.shire).toBeNull();
    expect(shared.avoidRivals.size).toBe(0);
    expect(shared.sort).toBe('idAsc');
    expect(shared.noRepOnly).toBe(false);
    expect(decodeJobsSearch('?p=garbage')!.place).toBeNull();
  });

  it('accepts percent-encoded separators too', () => {
    const shared = decodeJobsSearch('?f=rep_mschf%2Crep_pearl&p=zone%3A506%3A55', options)!;
    expect([...shared.factions].sort()).toEqual(['rep_mschf', 'rep_pearl']);
    expect(shared.place).toBe('zone:506:55');
  });

  it('?f=rep_mschf&norep=1 lists 32 jobs', () => {
    const shared = decodeJobsSearch('?f=rep_mschf&norep=1', options)!;
    expect(countMatching(jobs, { ...pristineFilter(), ...shared }, EMPTY_CONTEXT)).toBe(32);
  });
});
