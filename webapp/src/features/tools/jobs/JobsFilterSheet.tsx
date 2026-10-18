import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { withAlpha } from '../../../design-system/color';
import { IconExpandMore } from '../../../design-system/icons';
import { BottomSheet } from '../shared/BottomSheet';
import type { Job } from './jobModel';
import { computeFacetCounts, countOf, rankByCount, type JobsFacetOptions } from './jobsFacets';
import { activeSectionCount, NONE, resetSheetSections, type JobContext, type JobFilter } from './jobsLogic';
import { categoryLabel, factionInfo, rewardInfo, tagLabel } from './jobTaxonomies';
import styles from './Jobs.module.css';

const ACCENT_PRIMARY = '#4FC3FF';
const ACCENT_SECONDARY = '#7AE3FF';
/** Faction, Reward and Don't anger show this many chips before "+N more". */
const COLLAPSED_CHIPS = 8;

function toggleInSet(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function jobsText(n: number): string {
  return `${n} job${n === 1 ? '' : 's'}`;
}

/**
 * How a chip's count reads: `total` = jobs listed with it; `adds` = jobs it
 * would add to a section that already has a pick (OR); `hides` = jobs a
 * Don't anger choice removes.
 */
type CountMode = 'total' | 'adds' | 'hides';

function SelChip({
  label,
  tint,
  selected,
  count,
  mode = 'total',
  onToggle,
}: {
  label: string;
  tint: string;
  selected: boolean;
  count: number;
  mode?: CountMode;
  onToggle: () => void;
}) {
  // A pick that would empty the list is greyed out (a selected one stays live so it can be undone).
  const disabled = !selected && count === 0;
  const style: CSSProperties = selected
    ? { background: withAlpha(tint, 0.18), borderColor: withAlpha(tint, 0.8), color: tint }
    : {};
  const countText = count === 0 ? '0' : mode === 'hides' ? `−${count}` : mode === 'adds' ? `+${count}` : `${count}`;
  const spoken =
    mode === 'hides'
      ? `${label}, hides ${jobsText(count)}`
      : mode === 'adds'
        ? `${label}, adds ${jobsText(count)}`
        : `${label}, ${jobsText(count)}`;
  return (
    <button
      type="button"
      className={`${styles.selChip} ${disabled ? styles.selChipDisabled : ''}`}
      style={style}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={spoken}
      onClick={onToggle}
    >
      {label}
      <span className={styles.selChipCount} aria-hidden="true">
        {countText}
      </span>
    </button>
  );
}

/** Chips with a "+N more" fold after the first few; picked values always stay visible. */
function FoldingChips({
  keys,
  pinned,
  renderChip,
}: {
  keys: readonly string[];
  pinned: (key: string) => boolean;
  renderChip: (key: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? keys : keys.filter((key, i) => i < COLLAPSED_CHIPS || pinned(key));
  const hidden = keys.length - shown.length;
  return (
    <div className={styles.chipWrap}>
      {shown.map(renderChip)}
      {hidden > 0 && (
        <button type="button" className={styles.moreChip} aria-expanded={false} onClick={() => setExpanded(true)}>
          {`+${hidden} more`}
        </button>
      )}
      {expanded && keys.length > COLLAPSED_CHIPS && (
        <button type="button" className={styles.moreChip} aria-expanded={true} onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  describedBy,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.selectWrap}>
      <select
        id={id}
        className={styles.select}
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <span className={styles.selectChevron} aria-hidden="true">
        <IconExpandMore size={18} />
      </span>
    </div>
  );
}

function SectionHead({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className={styles.sectionHead}>
      <h3 id={id} className={styles.sectionHeading}>
        {title}
      </h3>
      {hint !== undefined && <span className={styles.sectionHint}>{hint}</span>}
    </div>
  );
}

/**
 * Filter sheet (spec §3.5): six sections - Faction, Pickup place, Category,
 * Reward, Requirements, Don't anger. Edits a draft with live contextual
 * counts; "Show N jobs" applies it, any other dismissal discards it.
 */
export function JobsFilterSheet({
  open,
  onClose,
  jobs,
  options,
  filter,
  ctx,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  jobs: readonly Job[];
  options: JobsFacetOptions;
  filter: JobFilter;
  ctx: JobContext;
  onApply: (next: JobFilter) => void;
}) {
  // Mounted only while open, so every opening starts from a fresh draft.
  if (!open) return null;
  return <FilterSheetDialog onClose={onClose} jobs={jobs} options={options} filter={filter} ctx={ctx} onApply={onApply} />;
}

function FilterSheetDialog({
  onClose,
  jobs,
  options,
  filter,
  ctx,
  onApply,
}: {
  onClose: () => void;
  jobs: readonly Job[];
  options: JobsFacetOptions;
  filter: JobFilter;
  ctx: JobContext;
  onApply: (next: JobFilter) => void;
}) {
  const [draft, setDraft] = useState<JobFilter>(filter);
  // Values picked when the sheet opened stay out of the fold even once unpicked.
  const [initial] = useState(filter);
  const counts = useMemo(() => computeFacetCounts(jobs, draft, ctx), [jobs, draft, ctx]);
  const uid = useId();
  const ids = {
    faction: `${uid}-faction`,
    place: `${uid}-place`,
    category: `${uid}-category`,
    reward: `${uid}-reward`,
    requirements: `${uid}-requirements`,
    skill: `${uid}-skill`,
    shire: `${uid}-shire`,
    shireHelp: `${uid}-shire-help`,
    avoid: `${uid}-avoid`,
  };

  const patch = (partial: Partial<JobFilter>) => setDraft((d) => ({ ...d, ...partial }));
  const factionLabel = (key: string) => factionInfo(key).label;
  const rewardLabel = (key: string) => rewardInfo(key).label;

  const factionKeys = rankByCount(options.factions, counts.factions, factionLabel);
  const rewardKeys = rankByCount(options.rewards, counts.rewards, rewardLabel);
  const rivalKeys = rankByCount(options.rivals, counts.avoidRivals, factionLabel);
  const skillKeys = rankByCount(options.skills, counts.skills, (k) => k);
  const shireKeys = rankByCount(options.shires, counts.shires, tagLabel);
  const astros = [...options.places.astros].sort(
    (a, b) => countOf(counts.places, b.key) - countOf(counts.places, a.key) || b.total - a.total || a.astnum - b.astnum,
  );

  const multiMode = (set: ReadonlySet<string>, key: string): CountMode =>
    set.size > 0 && !set.has(key) ? 'adds' : 'total';
  /** An option that would empty the list is disabled unless it is the current value. */
  const optionDisabled = (n: number, value: string, current: string | null) => n === 0 && value !== (current ?? '');
  const total = counts.total;

  const footer = (
    <button type="button" className={styles.applyBtn} onClick={() => onApply(draft)}>
      {`Show ${jobsText(total)}`}
    </button>
  );

  return (
    <BottomSheet open onClose={onClose} heightFraction={0.95} radius={22} ariaLabel="Filters" footer={footer}>
      <div className={styles.filterHeader}>
        <h2 className={styles.filterTitle}>Filters</h2>
        <button
          type="button"
          className={styles.resetBtn}
          disabled={activeSectionCount(draft) === 0}
          onClick={() => setDraft((d) => resetSheetSections(d))}
        >
          Reset
        </button>
      </div>
      <span className={styles.srOnly} aria-live="polite">
        {`${jobsText(total)} match`}
      </span>

      <div className={styles.filterBody}>
        {/* 1. Faction */}
        <section className={styles.section} aria-labelledby={ids.faction}>
          <SectionHead id={ids.faction} title="Faction" hint="Who gives the job" />
          <FoldingChips
            keys={factionKeys}
            pinned={(key) => draft.factions.has(key) || initial.factions.has(key)}
            renderChip={(key) => (
              <SelChip
                key={key}
                label={factionLabel(key)}
                tint={factionInfo(key).tint}
                count={countOf(counts.factions, key)}
                mode={multiMode(draft.factions, key)}
                selected={draft.factions.has(key)}
                onToggle={() => patch({ factions: toggleInSet(draft.factions, key) })}
              />
            )}
          />
        </section>

        {/* 2. Pickup place */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <label htmlFor={ids.place} className={styles.sectionHeading}>
              Pickup place
            </label>
          </div>
          <Select id={ids.place} value={draft.place ?? ''} onChange={(v) => patch({ place: v === '' ? null : v })}>
            <option value="">{`Any place (${counts.placeAny})`}</option>
            {astros.map((astro) => {
              const zones = [...astro.zones].sort(
                (a, b) => countOf(counts.places, b.key) - countOf(counts.places, a.key) || a.name.localeCompare(b.name),
              );
              const astroCount = countOf(counts.places, astro.key);
              return (
                <optgroup key={astro.key} label={astro.label}>
                  <option value={astro.key} disabled={optionDisabled(astroCount, astro.key, draft.place)}>
                    {`All of ${astro.label} (${astroCount})`}
                  </option>
                  {zones.map((zone) => {
                    const n = countOf(counts.places, zone.key);
                    return (
                      <option key={zone.key} value={zone.key} disabled={optionDisabled(n, zone.key, draft.place)}>
                        {`${zone.name} (${n})`}
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
          </Select>
        </section>

        {/* 3. Category */}
        <section className={styles.section} aria-labelledby={ids.category}>
          <SectionHead id={ids.category} title="Category" />
          <div className={styles.chipWrap}>
            {options.categories.map((key) => (
              <SelChip
                key={key}
                label={categoryLabel(key)}
                tint={ACCENT_PRIMARY}
                count={countOf(counts.categories, key)}
                mode={multiMode(draft.categories, key)}
                selected={draft.categories.has(key)}
                onToggle={() => patch({ categories: toggleInSet(draft.categories, key) })}
              />
            ))}
          </div>
        </section>

        {/* 4. Reward */}
        <section className={styles.section} aria-labelledby={ids.reward}>
          <SectionHead id={ids.reward} title="Reward" />
          <FoldingChips
            keys={rewardKeys}
            pinned={(key) => draft.rewards.has(key) || initial.rewards.has(key)}
            renderChip={(key) => (
              <SelChip
                key={key}
                label={rewardLabel(key)}
                tint={rewardInfo(key).tint}
                count={countOf(counts.rewards, key)}
                mode={multiMode(draft.rewards, key)}
                selected={draft.rewards.has(key)}
                onToggle={() => patch({ rewards: toggleInSet(draft.rewards, key) })}
              />
            )}
          />
        </section>

        {/* 5. Requirements */}
        <section className={styles.section} aria-labelledby={ids.requirements}>
          <SectionHead id={ids.requirements} title="Requirements" />
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor={ids.skill} className={styles.fieldLabel}>
                Skill
              </label>
              <Select id={ids.skill} value={draft.skill ?? ''} onChange={(v) => patch({ skill: v === '' ? null : v })}>
                <option value="">{`Any (${counts.skillAny})`}</option>
                <option value={NONE} disabled={optionDisabled(countOf(counts.skills, NONE), NONE, draft.skill)}>
                  {`No skill needed (${countOf(counts.skills, NONE)})`}
                </option>
                {skillKeys.map((key) => {
                  const n = countOf(counts.skills, key);
                  return (
                    <option key={key} value={key} disabled={optionDisabled(n, key, draft.skill)}>
                      {`${key} (${n})`}
                    </option>
                  );
                })}
              </Select>
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.shire} className={styles.fieldLabel}>
                Shire
              </label>
              <Select
                id={ids.shire}
                value={draft.shire ?? ''}
                describedBy={ids.shireHelp}
                onChange={(v) => patch({ shire: v === '' ? null : v })}
              >
                <option value="">{`Any (${counts.shireAny})`}</option>
                <option value={NONE} disabled={optionDisabled(countOf(counts.shires, NONE), NONE, draft.shire)}>
                  {`Open to all only (${countOf(counts.shires, NONE)})`}
                </option>
                {shireKeys.map((key) => {
                  const n = countOf(counts.shires, key);
                  return (
                    <option key={key} value={key} disabled={optionDisabled(n, key, draft.shire)}>
                      {`${tagLabel(key)} (${n})`}
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>
          <p id={ids.shireHelp} className={styles.fieldHelp}>
            Shows jobs open to everyone plus that shire&apos;s jobs.
          </p>
          <div className={styles.chipWrap}>
            <SelChip
              label="No reputation needed"
              tint={ACCENT_SECONDARY}
              count={counts.noRep}
              selected={draft.noRepOnly}
              onToggle={() => patch({ noRepOnly: !draft.noRepOnly })}
            />
          </div>
        </section>

        {/* 6. Don't anger */}
        <section className={styles.section} aria-labelledby={ids.avoid}>
          <SectionHead id={ids.avoid} title="Don't anger" hint="Hide jobs that hurt these factions" />
          <FoldingChips
            keys={rivalKeys}
            pinned={(key) => draft.avoidRivals.has(key) || initial.avoidRivals.has(key)}
            renderChip={(key) => (
              <SelChip
                key={key}
                label={factionLabel(key)}
                tint={factionInfo(key).tint}
                count={countOf(counts.avoidRivals, key)}
                mode="hides"
                selected={draft.avoidRivals.has(key)}
                onToggle={() => patch({ avoidRivals: toggleInSet(draft.avoidRivals, key) })}
              />
            )}
          />
        </section>
      </div>
    </BottomSheet>
  );
}
