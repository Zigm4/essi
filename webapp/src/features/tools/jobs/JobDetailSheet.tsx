import type { CSSProperties, ReactNode } from 'react';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { NeonButton } from '../../../design-system/components/NeonButton';
import { withAlpha } from '../../../design-system/color';
import { IconContentCopy, IconInfoOutline, IconMap } from '../../../design-system/icons';
import type { JobStatusValue } from '../../../data/db';
import { BottomSheet } from '../shared/BottomSheet';
import { FavoriteButton } from '../shared/FavoriteButton';
import { setJobStatus } from '../shared/jobStatus';
import { Markdown } from '../shared/markdown';
import { copyToClipboard, shareOrCopy } from '../shared/share';
import { IconGppBad, IconIosShare } from '../shared/toolIcons';
import { coordsLabel, type Job } from './jobModel';
import { locationDisplayLabel } from './jobPlaces';
import { factionInfo, rewardInfo, skillLabel, tagLabel } from './jobTaxonomies';
import styles from './Jobs.module.css';

const TEXT_SECONDARY = '#8AA4C2';
const ACCENT_WARN = '#FFB347';
const ACCENT_SUCCESS = '#5FE8A0';

const STATUS_SEGMENTS: readonly { value: JobStatusValue; label: string; tint: string }[] = [
  { value: 'todo', label: 'Not done', tint: TEXT_SECONDARY },
  { value: 'in_progress', label: 'In progress', tint: ACCENT_WARN },
  { value: 'done', label: 'Done', tint: ACCENT_SUCCESS },
];

/** `amount unknown` (bonus 0), `+{n}` (positive), `{n}` (negative). */
function bonusFactText(bonus: number): string {
  if (bonus === 0) return 'amount unknown';
  return bonus > 0 ? `+${bonus}` : `${bonus}`;
}

function skillText(job: Job): string {
  if (job.requiredSkill === null) return '-';
  const skill = skillLabel(job.requiredSkill);
  return job.requiredSkillAmt > 0 ? `${skill} ≥${job.requiredSkillAmt}` : skill;
}

/** `5 with Rustwind (RTS)` - the reputation applies to the faction giving the job; `-` when none is needed. */
function repText(job: Job): string {
  if (job.requiredRep <= 0) return '-';
  return job.factionRep === null
    ? String(job.requiredRep)
    : `${job.requiredRep} with ${factionInfo(job.factionRep).fullLabel}`;
}

/** `up.tech #874023 · Space Camera required`. */
function equipmentText(job: Job): string | null {
  const asset = job.requiredAsset;
  if (asset === null) return null;
  const ref = [asset.template, asset.id === null ? null : `#${asset.id}`].filter((p) => p !== null).join(' ');
  return asset.note === null ? ref : `${ref} · ${asset.note}`;
}

function FactRow({ label, value, tint, icon }: { label: string; value: string; tint?: string; icon?: ReactNode }) {
  const style: CSSProperties = tint !== undefined ? { color: tint } : {};
  return (
    <div className={styles.factRow}>
      <span className={styles.factKey}>{label}</span>
      <span className={styles.factValue} style={style}>
        {icon !== undefined && (
          <span className={styles.factIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        {value}
      </span>
    </div>
  );
}

export function JobDetailSheet({
  job,
  status,
  starred,
  onClose,
}: {
  job: Job | null;
  status: JobStatusValue;
  starred: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={job !== null}
      onClose={onClose}
      heightFraction={0.95}
      radius={22}
      ariaLabel="Job details"
    >
      {job !== null && <JobDetailContent job={job} status={status} starred={starred} />}
    </BottomSheet>
  );
}

function JobDetailContent({
  job,
  status,
  starred,
}: {
  job: Job;
  status: JobStatusValue;
  starred: boolean;
}) {
  const ally = job.factionRep !== null ? factionInfo(job.factionRep) : null;
  const harmed = job.harmedFaction !== null ? factionInfo(job.harmedFaction) : null;
  const gains = job.alsoGainsFaction !== null ? factionInfo(job.alsoGainsFaction) : null;
  const reward = rewardInfo(job.reward);
  const equipment = equipmentText(job);
  const showDataWarn = job.pickupLocation.astnum === 355 && job.pickupLocation.zone === 70;

  const onCopyId = () => {
    void copyToClipboard(String(job.id), `Copied #${job.id}`);
  };

  const onShare = () => {
    const lines = [
      `ESSI job #${job.id} - ${job.typeRaw}`,
      ally !== null ? `Allied: ${ally.fullLabel}` : null,
      gains !== null ? `Also gains: ${gains.fullLabel}` : null,
      harmed !== null ? `Loses rep: ${harmed.fullLabel}` : null,
      `Reward: ${reward.label} · ${bonusFactText(job.bonus)}`,
      `Risk: ${job.risk}`,
      `Pickup: ${coordsLabel(job.pickupLocation)}`,
      `Dropoff: ${coordsLabel(job.dropoffLocation)}`,
    ].filter((l): l is string => l !== null);
    void shareOrCopy(`ESSI job #${job.id}`, lines.join('\n'));
  };

  const onStatus = (next: JobStatusValue) => {
    void setJobStatus(String(job.id), next);
  };

  return (
    <div className={styles.detailStack}>
      <div className={styles.detailHeader}>
        <span className={styles.detailType}>{job.typeRaw.toUpperCase()}</span>
        <FavoriteButton kind="job" id={String(job.id)} active={starred} size={22} tooltip="Favorite" />
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Share job"
          title="Share job"
          onClick={onShare}
        >
          <IconIosShare size={20} />
        </button>
        <button
          type="button"
          className={styles.copyChip}
          aria-label={`Copy #${job.id}`}
          onClick={onCopyId}
        >
          <IconContentCopy size={12} />
          {`#${job.id}`}
        </button>
      </div>

      <div className={styles.statusSeg}>
        {STATUS_SEGMENTS.map((seg) => {
          const selected = status === seg.value;
          const style: CSSProperties = selected
            ? {
                background: withAlpha(seg.tint, 0.18),
                borderColor: withAlpha(seg.tint, 0.8),
                color: seg.tint,
              }
            : {};
          return (
            <button
              key={seg.value}
              type="button"
              className={styles.segBtn}
              style={style}
              aria-pressed={selected}
              onClick={() => onStatus(seg.value)}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {job.description.trim().length > 0 && (
        <GlassCard>
          <Markdown text={job.description} />
        </GlassCard>
      )}

      <GlassCard>
        <FactRow label="Allied faction" value={ally?.fullLabel ?? '-'} tint={ally?.tint} />
        {gains !== null && <FactRow label="Also gains rep" value={gains.fullLabel} tint={gains.tint} />}
        {harmed !== null && (
          <FactRow label="Loses rep" value={harmed.fullLabel} tint={harmed.tint} icon={<IconGppBad size={14} />} />
        )}
        <FactRow label="Required tag" value={job.requiredTag !== null ? tagLabel(job.requiredTag) : '-'} />
        <FactRow label="Required skill" value={skillText(job)} />
        <FactRow label="Required reputation" value={repText(job)} />
        {equipment !== null && <FactRow label="Equipment" value={equipment} tint={ACCENT_WARN} />}
        <FactRow label="Risk" value={String(job.risk)} />
        <FactRow
          label="Reward"
          value={`${reward.label} · ${bonusFactText(job.bonus)}`}
          tint={reward.tint}
        />
        <FactRow label="Pickup" value={locationDisplayLabel(job.pickupLocation)} />
        <FactRow label="Dropoff" value={locationDisplayLabel(job.dropoffLocation)} />
        {job.isCargoJob && (
          <FactRow
            label="Cargo"
            value={job.ship !== null ? `capacity ${job.capacity} · ship ${job.ship}` : `capacity ${job.capacity}`}
            tint={ACCENT_WARN}
          />
        )}
      </GlassCard>

      {job.mapRef !== null && (
        <NeonButton
          title="View on map"
          icon={<IconMap size={18} />}
          onPressed={() => {
            const zone = job.mapRef?.zoneId;
            const url =
              zone !== undefined
                ? `underdeck://map/${job.mapRef!.mapId}?zone=${zone}`
                : `underdeck://map/${job.mapRef!.mapId}`;
            window.location.href = url;
          }}
        />
      )}

      {job.onComplete.trim().length > 0 && (
        <GlassCard>
          <div className={styles.onCompleteHead}>ON COMPLETE</div>
          <Markdown text={job.onComplete} />
        </GlassCard>
      )}

      {showDataWarn && (
        <div className={styles.dataWarn}>
          <span className={styles.dataWarnIcon}>
            <IconInfoOutline size={14} />
          </span>
          <span className={styles.dataWarnText}>
            Source data may contain inconsistent zone comments. Verify locations in-game before
            travelling.
          </span>
        </div>
      )}
    </div>
  );
}
