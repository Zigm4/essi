import { useState, type CSSProperties, type ReactNode } from 'react';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { NeonButton } from '../../../design-system/components/NeonButton';
import { withAlpha } from '../../../design-system/color';
import { IconContentCopy, IconInfoOutline, IconMap } from '../../../design-system/icons';
import type { JobStatusValue } from '../../../data/db';
import { BottomSheet } from '../shared/BottomSheet';
import { FavoriteButton } from '../shared/FavoriteButton';
import { setJobStatus } from '../shared/jobStatus';
import { Markdown } from '../shared/markdown';
import { copyToClipboard } from '../shared/share';
import { ShareSheet } from '../shared/ShareSheet';
import type { ShareContent } from '../shared/shareActions';
import { IconGppBad, IconIosShare } from '../shared/toolIcons';
import { jobFactRows } from './jobFacts';
import type { Job } from './jobModel';
import { jobShare } from './jobShare';
import styles from './Jobs.module.css';

const TEXT_SECONDARY = '#8AA4C2';
const ACCENT_WARN = '#FFB347';
const ACCENT_SUCCESS = '#5FE8A0';

const STATUS_SEGMENTS: readonly { value: JobStatusValue; label: string; tint: string }[] = [
  { value: 'todo', label: 'Not done', tint: TEXT_SECONDARY },
  { value: 'in_progress', label: 'In progress', tint: ACCENT_WARN },
  { value: 'done', label: 'Done', tint: ACCENT_SUCCESS },
];

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
  const showDataWarn = job.pickupLocation.astnum === 355 && job.pickupLocation.zone === 70;

  const onCopyId = () => {
    void copyToClipboard(String(job.id), `Copied #${job.id}`);
  };

  const [share, setShare] = useState<ShareContent | null>(null);
  // Discord message, image or link (jobShare) - the same sheet as the NASA tools.
  const onShare = () => setShare(jobShare(job));

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
        {/* Same rows as the share card (jobFactRows), so the image matches the sheet. */}
        {jobFactRows(job).map((row) => (
          <FactRow
            key={row.label}
            label={row.label}
            value={row.value}
            tint={row.tint}
            icon={row.harm === true ? <IconGppBad size={14} /> : undefined}
          />
        ))}
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

      <ShareSheet content={share} onClose={() => setShare(null)} />

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
