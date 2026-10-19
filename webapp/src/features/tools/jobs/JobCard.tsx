import { memo, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { JobStatusValue } from '../../../data/db';
import { withAlpha } from '../../../design-system/color';
import { IconCheckCircle, IconLock, IconWarningAmber } from '../../../design-system/icons';
import { FavoriteButton } from '../shared/FavoriteButton';
import { stripMarkdown } from '../shared/markdown';
import {
  IconBolt,
  IconFlag,
  IconGppBad,
  IconLocalAtm,
  IconLocalShipping,
  IconPending,
  IconPlace,
  IconShieldOutlined,
} from '../shared/toolIcons';
import type { Job } from './jobModel';
import { locationDisplayLabel } from './jobPlaces';
import { costText } from './jobFacts';
import { factionInfo, rewardInfo, skillLabel, skillTint, tagLabel } from './jobTaxonomies';
import styles from './Jobs.module.css';

const ACCENT_DANGER = '#FF5577';
const ACCENT_WARN = '#FFB347';
const ACCENT_SUCCESS = '#5FE8A0';
const ACCENT_PRIMARY = '#4FC3FF';

/** `?` (bonus 0), `+{n}` (positive), `{n}` (negative). */
function bonusText(bonus: number): string {
  if (bonus === 0) return '?';
  return bonus > 0 ? `+${bonus}` : `${bonus}`;
}

function riskTint(risk: number): string {
  if (risk >= 7) return ACCENT_DANGER;
  if (risk >= 3) return ACCENT_WARN;
  return ACCENT_SUCCESS;
}

function tintStyle(tint: string, fillAlpha: number, borderAlpha: number): CSSProperties {
  return { background: withAlpha(tint, fillAlpha), borderColor: withAlpha(tint, borderAlpha), color: tint };
}

/** One row in the card's stats wrap: a 12px tinted icon + a mono label. */
function Stat({ icon, tint, label }: { icon: ReactNode; tint: string; label: string }) {
  return (
    <span className={styles.stat}>
      <span className={styles.statIcon} style={{ color: tint }}>
        {icon}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </span>
  );
}

/** Job list card (spec §3.4). Memoised: typing in the search re-renders the list, not every card. */
export const JobCard = memo(function JobCard({
  job,
  status,
  starred,
  onOpen,
}: {
  job: Job;
  status: JobStatusValue;
  starred: boolean;
  /** Receives the job id, so the list can pass one stable callback. */
  onOpen: (id: number) => void;
}) {
  const ally = job.factionRep !== null ? factionInfo(job.factionRep) : null;
  const harmed = job.harmedFaction !== null ? factionInfo(job.harmedFaction) : null;
  const gains = job.alsoGainsFaction !== null ? factionInfo(job.alsoGainsFaction) : null;
  const reward = rewardInfo(job.reward);
  const teaser = stripMarkdown(job.description);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(job.id);
    }
  };

  return (
    <div
      className={styles.jobCard}
      role="button"
      tabIndex={0}
      aria-label={`Job ${job.id}`}
      onClick={() => onOpen(job.id)}
      onKeyDown={onKeyDown}
    >
      <div className={styles.badgeRow}>
        <span className={styles.typeBadge}>{job.typeRaw.toUpperCase()}</span>
        {ally !== null && (
          <span className={styles.factionPill} style={tintStyle(ally.tint, 0.16, 0.7)}>
            {ally.label}
          </span>
        )}
        {gains !== null && (
          <span className={styles.rivalGroup} title={`${gains.label} also gains reputation`}>
            <span className={styles.gainSign} style={{ color: withAlpha(gains.tint, 0.9) }} aria-hidden="true">
              +
            </span>
            <span className={styles.factionPill} style={tintStyle(gains.tint, 0.06, 0.5)}>
              {gains.label}
            </span>
          </span>
        )}
        {harmed !== null && (
          <span className={styles.rivalGroup} title={`${harmed.label} loses reputation`}>
            <span className={styles.rivalIcon} style={{ color: withAlpha(harmed.tint, 0.9) }}>
              <IconGppBad size={11} />
            </span>
            <span className={styles.factionPill} style={tintStyle(harmed.tint, 0.06, 0.5)}>
              {harmed.label}
            </span>
          </span>
        )}

        <span className={styles.badgeRight}>
          {status === 'done' && (
            <span className={styles.statusPill} style={tintStyle(ACCENT_SUCCESS, 0.14, 0.6)}>
              <IconCheckCircle size={10} />
              DONE
            </span>
          )}
          {status === 'in_progress' && (
            <span className={styles.statusPill} style={tintStyle(ACCENT_WARN, 0.14, 0.6)}>
              <IconPending size={10} />
              WIP
            </span>
          )}
          <span className={styles.cardId}>{`#${job.id}`}</span>
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <FavoriteButton kind="job" id={String(job.id)} active={starred} size={18} />
          </span>
        </span>
      </div>

      {teaser.length > 0 && <div className={styles.teaser}>{teaser}</div>}

      <div className={styles.statsWrap}>
        {job.skillRequirement !== null && (
          <Stat
            icon={<IconBolt size={12} />}
            tint={skillTint(job.skillRequirement.skill)}
            label={`${skillLabel(job.skillRequirement.skill)} ≥${job.skillRequirement.min}`}
          />
        )}
        {job.trainsSkill !== null && (
          <Stat
            icon={<IconBolt size={12} />}
            tint={skillTint(job.trainsSkill.skill)}
            label={`trains ${skillLabel(job.trainsSkill.skill)}`}
          />
        )}
        {job.entryCost !== null && (
          <Stat
            icon={<IconBolt size={12} />}
            tint={skillTint(job.entryCost.resource)}
            label={`costs ${costText(job)}`}
          />
        )}
        {job.requiredRep > 0 && (
          <Stat
            icon={<IconFlag size={12} />}
            tint={ally?.tint ?? ACCENT_PRIMARY}
            label={ally !== null ? `rep ≥ ${job.requiredRep} ${ally.code}` : `rep ≥ ${job.requiredRep}`}
          />
        )}
        {job.requiredAsset !== null && (
          <Stat icon={<IconLock size={12} />} tint={ACCENT_WARN} label="equipment" />
        )}
        <Stat icon={<IconWarningAmber size={12} />} tint={riskTint(job.risk)} label={`risk ${job.risk}`} />
        <Stat
          icon={<IconLocalAtm size={12} />}
          tint={reward.tint}
          label={`${reward.label} ${bonusText(job.bonus)}`}
        />
        <Stat
          icon={<IconPlace size={12} />}
          tint={ACCENT_PRIMARY}
          label={
            job.isOnSite
              ? locationDisplayLabel(job.pickupLocation)
              : `${locationDisplayLabel(job.pickupLocation)} → ${locationDisplayLabel(job.dropoffLocation)}`
          }
        />
        {job.isCargoJob && (
          <Stat
            icon={<IconLocalShipping size={12} />}
            tint={ACCENT_WARN}
            label={job.ship !== null ? `cap ${job.capacity} · ${job.ship}` : `cap ${job.capacity}`}
          />
        )}
        {job.requiredTag !== null && (
          <Stat
            icon={<IconShieldOutlined size={12} />}
            tint={ACCENT_SUCCESS}
            label={tagLabel(job.requiredTag)}
          />
        )}
      </div>
    </div>
  );
});
