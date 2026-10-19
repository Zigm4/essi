import type { Job } from './jobModel';
import { locationDisplayLabel } from './jobPlaces';
import { factionInfo, rewardInfo, skillLabel, tagLabel } from './jobTaxonomies';

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

const ACCENT_WARN = '#FFB347';
const ACCENT_SUCCESS = '#5FE8A0';

/** One line of the job's fact table. */
export interface JobFactRow {
  label: string;
  value: string;
  /** Value colour (faction / reward tint, warning…); default text colour. */
  tint?: string;
  /** The faction loses reputation (the sheet adds the hostile icon). */
  harm?: boolean;
}

/**
 * The job's fact table, in the order the detail sheet shows it. The share
 * card draws the same rows, so the image always matches the sheet.
 */
export function jobFactRows(job: Job): JobFactRow[] {
  const ally = job.factionRep !== null ? factionInfo(job.factionRep) : null;
  const gains = job.alsoGainsFaction !== null ? factionInfo(job.alsoGainsFaction) : null;
  const harmed = job.harmedFaction !== null ? factionInfo(job.harmedFaction) : null;
  const reward = rewardInfo(job.reward);
  const trains = trainsText(job);
  const cost = costText(job);
  const equipment = equipmentText(job);
  const rows: (JobFactRow | null)[] = [
    { label: 'Allied faction', value: ally?.fullLabel ?? '-', tint: ally?.tint },
    gains !== null ? { label: 'Also gains rep', value: gains.fullLabel, tint: gains.tint } : null,
    harmed !== null ? { label: 'Loses rep', value: harmed.fullLabel, tint: harmed.tint, harm: true } : null,
    { label: 'Required tag', value: job.requiredTag !== null ? tagLabel(job.requiredTag) : '-' },
    { label: 'Required skill', value: skillText(job) },
    trains !== null ? { label: 'Trains', value: trains, tint: ACCENT_SUCCESS } : null,
    cost !== null ? { label: 'Cost', value: cost, tint: ACCENT_WARN } : null,
    { label: 'Required reputation', value: repText(job) },
    equipment !== null ? { label: 'Equipment', value: equipment, tint: ACCENT_WARN } : null,
    { label: 'Risk', value: String(job.risk) },
    { label: 'Reward', value: `${reward.label} · ${bonusFactText(job.bonus)}`, tint: reward.tint },
    { label: 'Pickup', value: locationDisplayLabel(job.pickupLocation) },
    { label: 'Dropoff', value: locationDisplayLabel(job.dropoffLocation) },
    job.isCargoJob
      ? {
          label: 'Cargo',
          value: job.ship !== null ? `capacity ${job.capacity} · ship ${job.ship}` : `capacity ${job.capacity}`,
          tint: ACCENT_WARN,
        }
      : null,
  ];
  return rows.filter((r): r is JobFactRow => r !== null);
}
