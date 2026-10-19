import type { Job } from './jobModel';
import { factionInfo, skillLabel } from './jobTaxonomies';

/** Job facts as the detail sheet and the share message word them. */

/** `amount unknown` (bonus 0), `+{n}` (positive), `{n}` (negative). */
export function bonusFactText(bonus: number): string {
  if (bonus === 0) return 'amount unknown';
  return bonus > 0 ? `+${bonus}` : `${bonus}`;
}

export function skillText(job: Job): string {
  if (job.requiredSkill === null) return '-';
  const skill = skillLabel(job.requiredSkill);
  return job.requiredSkillAmt > 0 ? `${skill} ≥${job.requiredSkillAmt}` : skill;
}

/** `5 with Rustwind (RTS)` - the reputation applies to the faction giving the job; `-` when none is needed. */
export function repText(job: Job): string {
  if (job.requiredRep <= 0) return '-';
  return job.factionRep === null
    ? String(job.requiredRep)
    : `${job.requiredRep} with ${factionInfo(job.factionRep).fullLabel}`;
}

/** `up.tech #874023 · Space Camera required`. */
export function equipmentText(job: Job): string | null {
  const asset = job.requiredAsset;
  if (asset === null) return null;
  const ref = [asset.template, asset.id === null ? null : `#${asset.id}`].filter((p) => p !== null).join(' ');
  return asset.note === null ? ref : `${ref} · ${asset.note}`;
}
