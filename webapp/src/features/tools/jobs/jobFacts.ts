import type { Job } from './jobModel';
import { factionInfo, skillLabel } from './jobTaxonomies';

/** Job facts as the detail sheet and the share message word them. */

/** `amount unknown` (bonus 0), `+{n}` (positive), `{n}` (negative). */
export function bonusFactText(bonus: number): string {
  if (bonus === 0) return 'amount unknown';
  return bonus > 0 ? `+${bonus}` : `${bonus}`;
}

/** `Knowledge ≥1` - a real minimum only (a trained skill or a cost isn't one); `-` when none. */
export function skillText(job: Job): string {
  const req = job.skillRequirement;
  return req === null ? '-' : `${skillLabel(req.skill)} ≥${req.min}`;
}

/** `Strength (+0.001)` - what a Beginner job trains, or null. */
export function trainsText(job: Job): string | null {
  const t = job.trainsSkill;
  if (t === null) return null;
  return t.gain === null ? skillLabel(t.skill) : `${skillLabel(t.skill)} (+${t.gain})`;
}

/** `50 coin`, `100 oil` - the resource a job takes, or null. */
export function costText(job: Job): string | null {
  const c = job.entryCost;
  if (c === null) return null;
  return `${c.amount} ${c.resource === 'carryCoin' ? 'coin' : c.resource}`;
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
