/**
 * Precomputed filter-sheet facets (spec §3.5) - distinct values + counts for
 * the TYPE / REWARD / REQUIRED SKILL chip lists, the type→bucket grouping, and
 * the bonus data extent. Computed once per loaded dataset.
 */

import type { Job } from './jobModel';
import { bonusExtent, type Range } from './jobsLogic';
import { BUCKET_ORDER, typeBucket } from './jobTaxonomies';

export interface CountedValue {
  key: string;
  count: number;
}

export interface TypeBucketGroup {
  bucket: string;
  types: CountedValue[];
}

export interface JobsFacets {
  /** TYPE chips grouped by bucket (buckets alphabetical, present only). */
  typeGroups: TypeBucketGroup[];
  /** Distinct canonical rewards present, sorted, with counts. */
  rewards: CountedValue[];
  /** Distinct required skills present, sorted, with counts. */
  skills: CountedValue[];
  bonusMin: number;
  bonusMax: number;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedCounted(map: Map<string, number>): CountedValue[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function computeFacets(jobs: readonly Job[]): JobsFacets {
  const typeCounts = new Map<string, number>();
  const rewardCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();

  for (const job of jobs) {
    increment(typeCounts, job.type);
    if (job.reward.length > 0) increment(rewardCounts, job.reward);
    if (job.requiredSkill !== null) increment(skillCounts, job.requiredSkill);
  }

  // Group the present types by bucket.
  const byBucket = new Map<string, CountedValue[]>();
  for (const [type, count] of typeCounts.entries()) {
    const bucket = typeBucket(type);
    const list = byBucket.get(bucket);
    if (list === undefined) byBucket.set(bucket, [{ key: type, count }]);
    else list.push({ key: type, count });
  }
  const typeGroups: TypeBucketGroup[] = [];
  for (const bucket of BUCKET_ORDER) {
    const types = byBucket.get(bucket);
    if (types !== undefined) {
      typeGroups.push({ bucket, types: types.sort((a, b) => a.key.localeCompare(b.key)) });
    }
  }

  const extent: Range = bonusExtent(jobs);
  return {
    typeGroups,
    rewards: toSortedCounted(rewardCounts),
    skills: toSortedCounted(skillCounts),
    bonusMin: extent[0],
    bonusMax: extent[1],
  };
}
