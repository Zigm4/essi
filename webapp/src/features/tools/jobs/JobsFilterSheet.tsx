import { useMemo, useState, type CSSProperties } from 'react';
import { withAlpha } from '../../../design-system/color';
import { BottomSheet } from '../shared/BottomSheet';
import { Switch } from '../shared/Switch';
import type { Job } from './jobModel';
import { accepts, type JobFilter, type Range } from './jobsLogic';
import type { JobsFacets } from './jobsFacets';
import {
  ACCENT_SUCCESS,
  ALLIED_FACTION_KEYS,
  factionInfo,
  RIVAL_FACTION_KEYS,
  rewardInfo,
  skillTint,
  TAG_KEYS,
  tagLabel,
} from './jobTaxonomies';
import styles from './Jobs.module.css';

const ACCENT_PRIMARY = '#4FC3FF';

function toggleInSet(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function parseIntOrNull(text: string): number | null {
  if (text.length === 0) return null;
  const n = Number.parseInt(text, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Clamps a previously-set finite bonus range into the data extent; an
 * untouched/unbounded (±Infinity) range collapses to the full extent (§3.5).
 */
function snapBonus(filter: JobFilter, facets: JobsFacets): Pick<JobFilter, 'bonus' | 'bonusMin' | 'bonusMax'> {
  const min = facets.bonusMin;
  const max = facets.bonusMax;
  let start = Number.isFinite(filter.bonus[0]) ? Math.min(Math.max(filter.bonus[0], min), max) : min;
  let end = Number.isFinite(filter.bonus[1]) ? Math.min(Math.max(filter.bonus[1], min), max) : max;
  if (start > end) {
    start = min;
    end = max;
  }
  return { bonus: [start, end], bonusMin: min, bonusMax: max };
}

interface ChipProps {
  label: string;
  tint: string;
  selected: boolean;
  count?: number;
  onToggle: () => void;
}

function SelChip({ label, tint, selected, count, onToggle }: ChipProps) {
  const disabled = count === 0;
  const style: CSSProperties = selected
    ? { background: withAlpha(tint, 0.18), borderColor: withAlpha(tint, 0.8), color: tint }
    : {};
  return (
    <button
      type="button"
      className={`${styles.selChip} ${disabled ? styles.selChipDisabled : ''}`}
      style={style}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {label}
      {count !== undefined && <span className={styles.selChipCount}>{`· ${count}`}</span>}
    </button>
  );
}

function DualRange({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: Range;
  onChange: (next: Range) => void;
}) {
  const [lo, hi] = value;
  return (
    <>
      <div className={styles.rangeReadout}>{`${Math.round(lo)} - ${Math.round(hi)}`}</div>
      <div className={styles.rangeRow}>
        <input
          type="range"
          className={styles.range}
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label="Minimum"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange([Math.min(v, hi), hi]);
          }}
        />
      </div>
      <div className={styles.rangeRow}>
        <input
          type="range"
          className={styles.range}
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label="Maximum"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange([lo, Math.max(v, lo)]);
          }}
        />
      </div>
    </>
  );
}

/** Modal filter sheet (spec §3.5). Edits a draft; nothing applies until Apply. */
export function JobsFilterSheet({
  open,
  onClose,
  jobs,
  facets,
  filter,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  jobs: readonly Job[];
  facets: JobsFacets;
  filter: JobFilter;
  onApply: (next: JobFilter) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} heightFraction={0.95} radius={22} ariaLabel="Filters">
      {open && (
        <FilterSheetBody jobs={jobs} facets={facets} filter={filter} onApply={onApply} />
      )}
    </BottomSheet>
  );
}

function FilterSheetBody({
  jobs,
  facets,
  filter,
  onApply,
}: {
  jobs: readonly Job[];
  facets: JobsFacets;
  filter: JobFilter;
  onApply: (next: JobFilter) => void;
}) {
  const [draft, setDraft] = useState<JobFilter>(() => ({ ...filter, ...snapBonus(filter, facets) }));
  const [pickupAst, setPickupAst] = useState(() => (filter.pickupAstnum?.toString() ?? ''));
  const [pickupZone, setPickupZone] = useState(() => (filter.pickupZone?.toString() ?? ''));
  const [dropoffAst, setDropoffAst] = useState(() => (filter.dropoffAstnum?.toString() ?? ''));
  const [dropoffZone, setDropoffZone] = useState(() => (filter.dropoffZone?.toString() ?? ''));

  const parsedLocations = {
    pickupAstnum: parseIntOrNull(pickupAst),
    pickupZone: parseIntOrNull(pickupZone),
    dropoffAstnum: parseIntOrNull(dropoffAst),
    dropoffZone: parseIntOrNull(dropoffZone),
  };

  const draftWithLocations: JobFilter = { ...draft, ...parsedLocations };

  // Live count uses only the job-intrinsic predicate (§3.5), incl. the
  // uncommitted location inputs, ignoring starred/status companion filters.
  const count = useMemo(
    () => jobs.reduce((acc, job) => (accepts(draftWithLocations, job) ? acc + 1 : acc), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, draft, pickupAst, pickupZone, dropoffAst, dropoffZone],
  );

  const patch = (partial: Partial<JobFilter>) => setDraft((d) => ({ ...d, ...partial }));

  const onReset = () => {
    setDraft((d) => ({
      ...d,
      query: d.query, // query lives in the search field, not the sheet - leave it
      types: new Set(),
      alliedFactions: new Set(),
      rivalFactions: new Set(),
      rewards: new Set(),
      skills: new Set(),
      tags: new Set(),
      skillAmt: [0, 100],
      requiredRep: [0, 8],
      risk: [0, 14],
      bonus: [facets.bonusMin, facets.bonusMax],
      bonusMin: facets.bonusMin,
      bonusMax: facets.bonusMax,
      pickupAstnum: null,
      pickupZone: null,
      dropoffAstnum: null,
      dropoffZone: null,
      onSiteOnly: false,
      cargoJobsOnly: false,
      rivalImpactOnly: false,
      hidePlaceholder: false,
      starredOnly: false,
      statuses: new Set(),
    }));
    setPickupAst('');
    setPickupZone('');
    setDropoffAst('');
    setDropoffZone('');
  };

  const onApplyClick = () => onApply(draftWithLocations);

  const bonusStep = Math.max((facets.bonusMax - facets.bonusMin) / 50, 1);

  return (
    <>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>Filters</span>
        <button type="button" className={styles.resetBtn} onClick={onReset}>
          Reset
        </button>
      </div>

      <div className={styles.filterBody}>
        {/* 1. TYPE */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Type</div>
          {facets.typeGroups.map((group) => (
            <div key={group.bucket}>
              <div className={styles.bucketHeading}>{group.bucket}</div>
              <div className={styles.chipWrap}>
                {group.types.map((t) => (
                  <SelChip
                    key={t.key}
                    label={t.key}
                    tint={ACCENT_PRIMARY}
                    count={t.count}
                    selected={draft.types.has(t.key)}
                    onToggle={() => patch({ types: toggleInSet(draft.types, t.key) })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 2. ALLIED FACTION */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Allied faction</div>
          <div className={styles.chipWrap}>
            {ALLIED_FACTION_KEYS.map((key) => {
              const info = factionInfo(key);
              return (
                <SelChip
                  key={key}
                  label={info.label}
                  tint={info.tint}
                  selected={draft.alliedFactions.has(key)}
                  onToggle={() => patch({ alliedFactions: toggleInSet(draft.alliedFactions, key) })}
                />
              );
            })}
          </div>
        </div>

        {/* 3. RIVAL FACTION */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Rival faction</div>
          <div className={styles.chipWrap}>
            {RIVAL_FACTION_KEYS.map((key) => {
              const info = factionInfo(key);
              return (
                <SelChip
                  key={key}
                  label={info.label}
                  tint={info.tint}
                  selected={draft.rivalFactions.has(key)}
                  onToggle={() => patch({ rivalFactions: toggleInSet(draft.rivalFactions, key) })}
                />
              );
            })}
          </div>
        </div>

        {/* 4. REWARD */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Reward</div>
          <div className={styles.chipWrap}>
            {facets.rewards.map((r) => {
              const info = rewardInfo(r.key);
              return (
                <SelChip
                  key={r.key}
                  label={info.label}
                  tint={info.tint}
                  count={r.count}
                  selected={draft.rewards.has(r.key)}
                  onToggle={() => patch({ rewards: toggleInSet(draft.rewards, r.key) })}
                />
              );
            })}
          </div>
        </div>

        {/* 5. BONUS */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Bonus</div>
          <DualRange
            min={facets.bonusMin}
            max={facets.bonusMax}
            step={bonusStep}
            value={draft.bonus}
            onChange={(bonus) => patch({ bonus })}
          />
        </div>

        {/* 6. REQUIRED SKILL */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Required skill</div>
          <div className={styles.chipWrap}>
            {facets.skills.map((s) => (
              <SelChip
                key={s.key}
                label={s.key}
                tint={skillTint(s.key)}
                count={s.count}
                selected={draft.skills.has(s.key)}
                onToggle={() => patch({ skills: toggleInSet(draft.skills, s.key) })}
              />
            ))}
          </div>
        </div>

        {/* 7. SKILL AMOUNT REQUIRED */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Skill amount required</div>
          <DualRange min={0} max={100} step={5} value={draft.skillAmt} onChange={(skillAmt) => patch({ skillAmt })} />
        </div>

        {/* 8. REQUIRED REPUTATION */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Required reputation</div>
          <DualRange min={0} max={8} step={1} value={draft.requiredRep} onChange={(requiredRep) => patch({ requiredRep })} />
        </div>

        {/* 9. REQUIRED TAG */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Required tag</div>
          <div className={styles.chipWrap}>
            {TAG_KEYS.map((key) => (
              <SelChip
                key={key}
                label={tagLabel(key)}
                tint={ACCENT_SUCCESS}
                selected={draft.tags.has(key)}
                onToggle={() => patch({ tags: toggleInSet(draft.tags, key) })}
              />
            ))}
          </div>
        </div>

        {/* 10. RISK */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Risk</div>
          <DualRange min={0} max={14} step={1} value={draft.risk} onChange={(risk) => patch({ risk })} />
        </div>

        {/* 11. LOCATION */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Location</div>
          <div className={styles.locRow}>
            <span className={styles.locLabel}>Pickup</span>
            <input
              className={styles.locInput}
              inputMode="numeric"
              placeholder="astnum"
              value={pickupAst}
              onChange={(e) => setPickupAst(digitsOnly(e.target.value))}
            />
            <input
              className={`${styles.locInput} ${styles.locInputZone}`}
              inputMode="numeric"
              placeholder="zone"
              value={pickupZone}
              onChange={(e) => setPickupZone(digitsOnly(e.target.value))}
            />
          </div>
          <div className={styles.locRow}>
            <span className={styles.locLabel}>Dropoff</span>
            <input
              className={styles.locInput}
              inputMode="numeric"
              placeholder="astnum"
              value={dropoffAst}
              onChange={(e) => setDropoffAst(digitsOnly(e.target.value))}
            />
            <input
              className={`${styles.locInput} ${styles.locInputZone}`}
              inputMode="numeric"
              placeholder="zone"
              value={dropoffZone}
              onChange={(e) => setDropoffZone(digitsOnly(e.target.value))}
            />
          </div>
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>On-site only (pickup = dropoff)</span>
            <Switch
              checked={draft.onSiteOnly}
              onChange={(v) => patch({ onSiteOnly: v })}
              tint="var(--accent-success)"
              ariaLabel="On-site only"
            />
          </div>
        </div>

        {/* 12. MORE */}
        <div className={styles.section}>
          <div className={styles.sectionHeading}>More</div>
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>Cargo jobs only</span>
            <Switch checked={draft.cargoJobsOnly} onChange={(v) => patch({ cargoJobsOnly: v })} ariaLabel="Cargo jobs only" />
          </div>
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>Has rival impact</span>
            <Switch checked={draft.rivalImpactOnly} onChange={(v) => patch({ rivalImpactOnly: v })} ariaLabel="Has rival impact" />
          </div>
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>Hide “???” type</span>
            <Switch checked={draft.hidePlaceholder} onChange={(v) => patch({ hidePlaceholder: v })} ariaLabel="Hide ??? type" />
          </div>
        </div>
      </div>

      <div className={styles.filterFooter}>
        <span className={styles.footerCount}>{`${count} result${count === 1 ? '' : 's'}`}</span>
        <button type="button" className={styles.applyBtn} onClick={onApplyClick}>
          Apply
        </button>
      </div>
    </>
  );
}
