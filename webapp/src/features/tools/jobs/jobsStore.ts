import { create } from 'zustand';
import { resetAllFilters, type JobFilter } from './jobsLogic';
import { loadPersistedFilter, persistFilter, serializeFilter } from './jobsPersist';

/**
 * App-lifetime jobs filter store (spec §3.3). Seeded from localStorage and
 * saved back on every change (minus the search, which starts empty after a
 * reload). The search field is a controlled input bound to `filter.query`, so
 * re-mounting initialises from the stored query.
 */
interface JobsFilterState {
  filter: JobFilter;
  setFilter: (filter: JobFilter) => void;
  patch: (partial: Partial<JobFilter>) => void;
  /** Clears sheet, quick filters and search (sort kept) - the empty state's escape hatch. */
  resetAll: () => void;
}

export const useJobsFilterStore = create<JobsFilterState>((set) => ({
  filter: loadPersistedFilter(),
  setFilter: (filter) => set({ filter }),
  patch: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),
  resetAll: () => set((s) => ({ filter: resetAllFilters(s.filter) })),
}));

// Typing in the search changes the filter but not what is stored - skip those writes.
let lastSaved = serializeFilter(useJobsFilterStore.getState().filter);
useJobsFilterStore.subscribe((state, prev) => {
  if (state.filter === prev.filter) return;
  const next = serializeFilter(state.filter);
  if (next === lastSaved) return;
  lastSaved = next;
  persistFilter(state.filter);
});
