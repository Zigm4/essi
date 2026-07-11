import { create } from 'zustand';

interface SnackbarState {
  message: string | null;
  danger: boolean;
  /** Bumps on every show so an identical message still re-triggers the toast. */
  key: number;
  show: (message: string, options?: { danger?: boolean }) => void;
  dismiss: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  message: null,
  danger: false,
  key: 0,
  show: (message, options) =>
    set((s) => ({ message, danger: options?.danger ?? false, key: s.key + 1 })),
  dismiss: () => set({ message: null }),
}));

/** Imperative entry point usable outside React components. */
export function showSnackbar(message: string, options?: { danger?: boolean }): void {
  useSnackbarStore.getState().show(message, options);
}
