import { create } from 'zustand';
import { pristineFilter, type JobFilter } from './jobsLogic';

/**
 * App-lifetime jobs filter store (spec §3.3): the filter survives navigating
 * away and back within a session (it is module-level zustand state, not reset
 * on unmount) and is lost on reload. The search field is a controlled input
 * bound to `filter.query`, so re-mounting initialises from the stored query.
 */
interface JobsFilterState {
  filter: JobFilter;
  setFilter: (filter: JobFilter) => void;
  patch: (partial: Partial<JobFilter>) => void;
  reset: () => void;
}

export const useJobsFilterStore = create<JobsFilterState>((set) => ({
  filter: pristineFilter(),
  setFilter: (filter) => set({ filter }),
  patch: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),
  reset: () => set({ filter: pristineFilter() }),
}));
