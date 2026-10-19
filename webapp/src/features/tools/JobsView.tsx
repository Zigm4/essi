import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../../design-system/components/AppBackground';
import { BannerAction, TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { withAlpha } from '../../design-system/color';
import {
  IconArrowBack,
  IconCheckCircle,
  IconClose,
  IconExploreOff,
  IconInfoOutline,
  IconPublic,
  IconSearch,
  IconTune,
} from '../../design-system/icons';
import { createScrollOffsetStore, ScrollOffsetContext } from '../../design-system/scrollOffset';
import type { JobStatusValue } from '../../data/db';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { useFavoriteSet } from './shared/favorites';
import { useJobStatusMap } from './shared/jobStatus';
import { IconPending, IconRadioUnchecked, IconSort, IconStarFilled } from './shared/toolIcons';
import { JobCard } from './jobs/JobCard';
import { JobsFilterSheet } from './jobs/JobsFilterSheet';
import { JobDetailSheet } from './jobs/JobDetailSheet';
import { AboutDatasetSheet } from './jobs/AboutDatasetSheet';
import { computeFacetOptions } from './jobs/jobsFacets';
import {
  activeFilterChips,
  activeSectionCount,
  countMatching,
  hasAnyCriteria,
  JOB_SORTS,
  sortLabel,
  visibleJobs,
  type JobContext,
  type JobFilter,
  type JobSort,
} from './jobs/jobsLogic';
import { useJobsFilterStore } from './jobs/jobsStore';
import { useJobs } from './jobs/useJobs';
import { useJobsUrlSync } from './jobs/useJobsUrlSync';
import styles from './jobs/Jobs.module.css';

const ACCENT_WARN = '#FFB347';
const ACCENT_SECONDARY = '#7AE3FF';
const ACCENT_SUCCESS = '#5FE8A0';

function toggleSet<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function chipStyle(tint: string, active: boolean): CSSProperties {
  return active
    ? { background: withAlpha(tint, 0.18), borderColor: withAlpha(tint, 0.7), color: tint }
    : {};
}

/** /tools/jobs - search 371 jobs by faction, place, category, reward, requirements (spec §3.3). */
export function JobsView() {
  const navigate = useNavigate();
  const storeRef = useRef(createScrollOffsetStore());
  const { jobs, error } = useJobs();
  const starred = useFavoriteSet('job');
  const statusMap = useJobStatusMap();
  const filter = useJobsFilterStore((s) => s.filter);
  const setFilter = useJobsFilterStore((s) => s.setFilter);
  const patch = useJobsFilterStore((s) => s.patch);
  const resetAll = useJobsFilterStore((s) => s.resetAll);

  const [filterOpen, setFilterOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const options = useMemo(() => (jobs === null ? null : computeFacetOptions(jobs)), [jobs]);
  const ctx = useMemo<JobContext>(
    () => ({ starred, statusMap, zoneNames: options?.places.zoneNames }),
    [starred, statusMap, options],
  );
  const visible = useMemo(() => (jobs === null ? [] : visibleJobs(jobs, filter, ctx)), [jobs, filter, ctx]);
  const noPrereqCount = useMemo(
    () => (jobs === null ? 0 : countMatching(jobs, { ...filter, noPrereqOnly: true }, ctx)),
    [jobs, filter, ctx],
  );
  useJobsUrlSync(options, filter, setFilter);

  const chips = activeFilterChips(filter, options?.places ?? null);
  const badge = activeSectionCount(filter);
  const detailJob = detailId === null || jobs === null ? null : jobs.find((j) => j.id === detailId) ?? null;

  const statusOf = (id: number): JobStatusValue => statusMap.get(String(id)) ?? 'todo';

  // Removing the focused active chip unmounts it: keep keyboard focus in the row
  // (the chip that took its place, else the Filters button).
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const refocusChipAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = refocusChipAt.current;
    if (at === null) return;
    refocusChipAt.current = null;
    const remaining = activeRowRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [];
    (remaining[Math.min(at, remaining.length - 1)] ?? filtersBtnRef.current)?.focus();
  });

  // A shared link opened in a fresh tab has no in-app history to go back to.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/tools');
  };

  return (
    <ScrollOffsetContext.Provider value={storeRef.current}>
      <AppBackground>
        <div className={styles.screen}>
          <div className={styles.headerRegion}>
            <TransmissionHeader
              label="ESSI · Job Allocation Desk"
              actions={
                <BannerAction label="About this dataset" onTap={() => setAboutOpen(true)}>
                  <IconInfoOutline size={18} />
                </BannerAction>
              }
            />

            <div className={styles.searchRow}>
              <button type="button" className={styles.backBtn} aria-label="Back" onClick={goBack}>
                <IconArrowBack size={20} />
              </button>
              <div className={styles.searchField}>
                <span className={styles.searchIcon}>
                  <IconSearch size={18} />
                </span>
                <input
                  className={styles.searchInput}
                  aria-label="Search jobs"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Search jobs, factions, places, #ID"
                  value={filter.query}
                  onChange={(e) => patch({ query: e.target.value })}
                />
                {filter.query.length > 0 && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    aria-label="Clear search"
                    onClick={() => patch({ query: '' })}
                  >
                    <IconClose size={16} />
                  </button>
                )}
              </div>

              <button
                ref={filtersBtnRef}
                type="button"
                className={`${styles.filtersBtn} ${badge > 0 ? styles.filtersBtnActive : ''}`}
                aria-label={badge > 0 ? `Filters, ${badge} active` : 'Filters'}
                onClick={() => setFilterOpen(true)}
              >
                <IconTune size={16} />
                <span className={styles.filtersLabel}>Filters</span>
                {badge > 0 && (
                  <span className={styles.filtersBadge} aria-hidden="true">
                    {badge}
                  </span>
                )}
              </button>

              <SortMenu value={filter.sort} onChange={(sort) => patch({ sort })} />
            </div>

            {/* No prerequisites sits second so it is on screen at 375px; the cut-off status chip signals the row scrolls. */}
            <div className={`${styles.chipScroll} ${styles.quickRow}`}>
              <QuickChip
                label="Starred"
                icon={<IconStarFilled size={13} />}
                tint={ACCENT_WARN}
                active={filter.starredOnly}
                onClick={() => patch({ starredOnly: !filter.starredOnly })}
              />
              <QuickChip
                label="No prerequisites"
                icon={<IconPublic size={13} />}
                tint={ACCENT_SUCCESS}
                active={filter.noPrereqOnly}
                count={jobs === null ? undefined : noPrereqCount}
                onClick={() => patch({ noPrereqOnly: !filter.noPrereqOnly })}
              />
              <QuickChip
                label="To do"
                icon={<IconRadioUnchecked size={13} />}
                tint={ACCENT_SECONDARY}
                active={filter.statuses.has('todo')}
                onClick={() => patch({ statuses: toggleSet(filter.statuses, 'todo') })}
              />
              <QuickChip
                label="In progress"
                icon={<IconPending size={13} />}
                tint={ACCENT_WARN}
                active={filter.statuses.has('in_progress')}
                onClick={() => patch({ statuses: toggleSet(filter.statuses, 'in_progress') })}
              />
              <QuickChip
                label="Done"
                icon={<IconCheckCircle size={13} />}
                tint={ACCENT_SUCCESS}
                active={filter.statuses.has('done')}
                onClick={() => patch({ statuses: toggleSet(filter.statuses, 'done') })}
              />
            </div>

            {chips.length > 0 && (
              <div ref={activeRowRef} className={`${styles.chipScroll} ${styles.activeRow}`}>
                {chips.map((chip, i) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={styles.activeChip}
                    style={{ background: withAlpha(chip.tint, 0.18), borderColor: withAlpha(chip.tint, 0.7), color: chip.tint }}
                    aria-label={`Remove filter: ${chip.label}`}
                    onClick={(e) => {
                      if (document.activeElement === e.currentTarget) refocusChipAt.current = i;
                      setFilter(chip.remove(filter));
                    }}
                  >
                    {chip.label}
                    <IconClose size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Announces the result count after a quick filter, chip removal or search (always mounted). */}
          <span className={styles.srOnly} role="status">
            {jobs === null ? '' : `${visible.length} job${visible.length === 1 ? '' : 's'}`}
          </span>

          <div
            className={styles.list}
            onScroll={(e) => storeRef.current.set(e.currentTarget.scrollTop)}
          >
            {error !== null ? (
              <CenteredError message={error} />
            ) : jobs === null ? (
              <CenteredSpinner />
            ) : visible.length === 0 ? (
              <EmptyState anyActive={hasAnyCriteria(filter)} onReset={resetAll} />
            ) : (
              <>
                <div className={styles.summaryLine}>
                  {`${visible.length} job${visible.length === 1 ? '' : 's'} · sorted by ${sortLabel(filter.sort)}`}
                </div>
                {visible.map((job, i) => (
                  <div className={styles.cardGap} key={`${job.id}-${i}`}>
                    <JobCard
                      job={job}
                      status={statusOf(job.id)}
                      starred={starred.has(String(job.id))}
                      onOpen={setDetailId}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </AppBackground>

      {options !== null && jobs !== null && (
        <JobsFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          jobs={jobs}
          options={options}
          filter={filter}
          ctx={ctx}
          onApply={(next: JobFilter) => {
            setFilter(next);
            setFilterOpen(false);
          }}
        />
      )}

      <JobDetailSheet
        job={detailJob}
        status={detailJob !== null ? statusOf(detailJob.id) : 'todo'}
        starred={detailJob !== null && starred.has(String(detailJob.id))}
        onClose={() => setDetailId(null)}
      />

      <AboutDatasetSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </ScrollOffsetContext.Provider>
  );
}

/** Sort button + popup menu (radio items; Escape closes, arrows move). */
function SortMenu({ value, onChange }: { value: JobSort; onChange: (sort: JobSort) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (at + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Tab') close(false);
    if (next >= 0) {
      e.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <div className={styles.sortWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.sortBtn}
        aria-label={`Sort: ${sortLabel(value)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Sort"
        onClick={() => setOpen((v) => !v)}
      >
        <IconSort size={18} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => close(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'transparent', border: 'none' }}
          />
          <div ref={menuRef} className={styles.sortMenu} role="menu" aria-label="Sort jobs" onKeyDown={onMenuKeyDown}>
            {JOB_SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="menuitemradio"
                aria-checked={value === s.value}
                tabIndex={value === s.value ? 0 : -1}
                className={`${styles.sortItem} ${value === s.value ? styles.sortItemActive : ''}`}
                onClick={() => {
                  onChange(s.value);
                  close(true);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuickChip({
  label,
  icon,
  tint,
  active,
  count,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  tint: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.quickChip}
      style={chipStyle(tint, active)}
      aria-pressed={active}
      aria-label={count === undefined ? undefined : `${label}, ${count} job${count === 1 ? '' : 's'}`}
      onClick={onClick}
    >
      <span style={{ display: 'inline-flex', color: active ? tint : undefined }}>{icon}</span>
      {label}
      {count !== undefined && (
        <span className={styles.quickChipCount} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ anyActive, onReset }: { anyActive: boolean; onReset: () => void }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <IconExploreOff size={48} />
      </span>
      <span className={styles.emptyHeadline}>{anyActive ? 'No jobs match these filters.' : 'No jobs.'}</span>
      {anyActive && (
        <>
          <span className={styles.emptyCaption}>Loosen the criteria or reset everything.</span>
          <button type="button" className={styles.resetTonal} onClick={onReset}>
            Clear all filters &amp; search
          </button>
        </>
      )}
    </div>
  );
}
