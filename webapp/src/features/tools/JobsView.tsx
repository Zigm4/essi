import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { computeFacets } from './jobs/jobsFacets';
import {
  activeCount,
  activeFilterChips,
  JOB_SORTS,
  sortLabel,
  visibleJobs,
  type JobFilter,
  type JobSort,
} from './jobs/jobsLogic';
import { useJobsFilterStore } from './jobs/jobsStore';
import { useJobs } from './jobs/useJobs';
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

/** /tools/jobs — search 371 jobs by faction, reward, skill, location (spec §3.3). */
export function JobsView() {
  const navigate = useNavigate();
  const storeRef = useRef(createScrollOffsetStore());
  const { jobs, error } = useJobs();
  const starred = useFavoriteSet('job');
  const statusMap = useJobStatusMap();
  const filter = useJobsFilterStore((s) => s.filter);
  const setFilter = useJobsFilterStore((s) => s.setFilter);
  const patch = useJobsFilterStore((s) => s.patch);
  const reset = useJobsFilterStore((s) => s.reset);

  const [filterOpen, setFilterOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const facets = useMemo(() => (jobs === null ? null : computeFacets(jobs)), [jobs]);
  const visible = useMemo(
    () => (jobs === null ? [] : visibleJobs(jobs, filter, starred, statusMap)),
    [jobs, filter, starred, statusMap],
  );
  const chips = activeFilterChips(filter);
  const badge = activeCount(filter);
  const detailJob = detailId === null || jobs === null ? null : jobs.find((j) => j.id === detailId) ?? null;

  const statusOf = (id: number): JobStatusValue => statusMap.get(String(id)) ?? 'todo';

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
              <button type="button" className={styles.backBtn} aria-label="Back" onClick={() => navigate(-1)}>
                <IconArrowBack size={20} />
              </button>
              <div className={styles.searchField}>
                <span className={styles.searchIcon}>
                  <IconSearch size={18} />
                </span>
                <input
                  className={styles.searchInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Search description, on-complete, or #ID"
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
                type="button"
                className={`${styles.filtersBtn} ${badge > 0 ? styles.filtersBtnActive : ''}`}
                onClick={() => setFilterOpen(true)}
              >
                <IconTune size={16} />
                Filters
                {badge > 0 && <span className={styles.filtersBadge}>{badge}</span>}
              </button>

              <div className={styles.sortWrap}>
                <button
                  type="button"
                  className={styles.sortBtn}
                  aria-label="Sort"
                  title="Sort"
                  onClick={() => setSortOpen((v) => !v)}
                >
                  <IconSort size={18} />
                </button>
                {sortOpen && (
                  <>
                    <button
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      onClick={() => setSortOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'transparent', border: 'none' }}
                    />
                    <div className={styles.sortMenu} role="menu">
                      {JOB_SORTS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          role="menuitem"
                          className={`${styles.sortItem} ${filter.sort === s.value ? styles.sortItemActive : ''}`}
                          onClick={() => {
                            patch({ sort: s.value as JobSort });
                            setSortOpen(false);
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={`${styles.chipScroll} ${styles.quickRow}`}>
              <QuickChip
                label="Starred"
                icon={<IconStarFilled size={13} />}
                tint={ACCENT_WARN}
                active={filter.starredOnly}
                onClick={() => patch({ starredOnly: !filter.starredOnly })}
              />
              <QuickChip
                label="Not done"
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
              <div className={`${styles.chipScroll} ${styles.activeRow}`}>
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={styles.activeChip}
                    style={{ background: withAlpha(chip.tint, 0.18), borderColor: withAlpha(chip.tint, 0.7), color: chip.tint }}
                    onClick={() => setFilter(chip.remove(filter))}
                  >
                    {chip.label}
                    <IconClose size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={styles.list}
            onScroll={(e) => storeRef.current.set(e.currentTarget.scrollTop)}
          >
            {error !== null ? (
              <CenteredError message={error} />
            ) : jobs === null ? (
              <CenteredSpinner />
            ) : visible.length === 0 ? (
              <EmptyState anyActive={badge > 0} onReset={reset} />
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
                      onOpen={() => setDetailId(job.id)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </AppBackground>

      {facets !== null && jobs !== null && (
        <JobsFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          jobs={jobs}
          facets={facets}
          filter={filter}
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

function QuickChip({
  label,
  icon,
  tint,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  tint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.quickChip}
      style={chipStyle(tint, active)}
      aria-pressed={active}
      onClick={onClick}
    >
      <span style={{ display: 'inline-flex', color: active ? tint : undefined }}>{icon}</span>
      {label}
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
            Reset filters
          </button>
        </>
      )}
    </div>
  );
}
