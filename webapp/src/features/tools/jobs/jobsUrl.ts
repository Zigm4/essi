/**
 * Shareable jobs links (spec §3.3): the six sheet sections, the search and the
 * sort live in the hash route's query string, e.g.
 * `#/tools/jobs?f=rep_mschf,rep_pearl&cat=beginner&p=ast:355&norep=1&sort=bonusDesc`.
 * Favorites, statuses and No prerequisites stay out of the URL (they depend on
 * the viewer's own progress). Pure - JobsView does the router wiring.
 */

import { sanitizeFilter, type JobsFacetOptions } from './jobsFacets';
import { isJobSort, pristineFilter, type JobFilter } from './jobsLogic';
import { parsePlaceKey } from './jobPlaces';
import { JOB_CATEGORIES } from './jobTaxonomies';

/** The filter fields a link carries. */
export type SharedFields = Pick<
  JobFilter,
  'factions' | 'place' | 'categories' | 'rewards' | 'skill' | 'shire' | 'noRepOnly' | 'avoidRivals' | 'query' | 'sort'
>;

/** Short parameter names, in the order they are written. */
const PARAM = {
  factions: 'f',
  categories: 'cat',
  place: 'p',
  rewards: 'r',
  skill: 'sk',
  shire: 'sh',
  noRep: 'norep',
  avoid: 'avoid',
  query: 'q',
  sort: 'sort',
} as const;

const ALL_PARAMS: readonly string[] = Object.values(PARAM);
const CATEGORY_KEYS = new Set(JOB_CATEGORIES.map((c) => c.key));

function joinSet(set: ReadonlySet<string>): string {
  return [...set].sort().join(',');
}

function splitList(raw: string | null): Set<string> {
  if (raw === null) return new Set();
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

/** `?…` for the shareable part of the filter, or `''` when nothing is set. Values sorted → stable URLs. */
export function encodeJobsSearch(filter: JobFilter): string {
  const params = new URLSearchParams();
  if (filter.factions.size > 0) params.set(PARAM.factions, joinSet(filter.factions));
  if (filter.categories.size > 0) params.set(PARAM.categories, joinSet(filter.categories));
  if (filter.place !== null) params.set(PARAM.place, filter.place);
  if (filter.rewards.size > 0) params.set(PARAM.rewards, joinSet(filter.rewards));
  if (filter.skill !== null) params.set(PARAM.skill, filter.skill);
  if (filter.shire !== null) params.set(PARAM.shire, filter.shire);
  if (filter.noRepOnly) params.set(PARAM.noRep, '1');
  if (filter.avoidRivals.size > 0) params.set(PARAM.avoid, joinSet(filter.avoidRivals));
  if (filter.query.length > 0) params.set(PARAM.query, filter.query);
  if (filter.sort !== 'idAsc') params.set(PARAM.sort, filter.sort);
  // `,` and `:` are legal in a query string - keep the link readable.
  const text = params.toString().replace(/%2C/gi, ',').replace(/%3A/gi, ':');
  return text.length > 0 ? `?${text}` : '';
}

/**
 * The shared fields a query string carries, or null when it has none of the
 * jobs parameters. Fields the link leaves out take their pristine value (a
 * link reproduces exactly what was shared). Malformed values are dropped;
 * with `options`, so are values absent from the data.
 */
export function decodeJobsSearch(search: string, options?: JobsFacetOptions): SharedFields | null {
  const params = new URLSearchParams(search);
  if (!ALL_PARAMS.some((name) => params.has(name))) return null;

  const place = params.get(PARAM.place);
  const sort = params.get(PARAM.sort);
  const skill = params.get(PARAM.skill)?.trim() ?? '';
  const shire = params.get(PARAM.shire)?.trim() ?? '';
  const decoded: JobFilter = {
    ...pristineFilter(),
    factions: splitList(params.get(PARAM.factions)),
    categories: new Set([...splitList(params.get(PARAM.categories))].filter((c) => CATEGORY_KEYS.has(c))),
    place: place !== null && parsePlaceKey(place) !== null ? place : null,
    rewards: splitList(params.get(PARAM.rewards)),
    skill: skill.length > 0 ? skill : null,
    shire: shire.length > 0 ? shire : null,
    noRepOnly: params.get(PARAM.noRep) === '1',
    avoidRivals: splitList(params.get(PARAM.avoid)),
    query: params.get(PARAM.query) ?? '',
    sort: isJobSort(sort) ? sort : 'idAsc',
  };
  const clean = options === undefined ? decoded : sanitizeFilter(decoded, options);
  return {
    factions: clean.factions,
    place: clean.place,
    categories: clean.categories,
    rewards: clean.rewards,
    skill: clean.skill,
    shire: clean.shire,
    noRepOnly: clean.noRepOnly,
    avoidRivals: clean.avoidRivals,
    query: clean.query,
    sort: clean.sort,
  };
}
