import { create } from 'zustand';

export interface SnackbarAction {
  label: string;
  onClick: () => void;
}

export interface SnackbarOptions {
  danger?: boolean;
  /** Optional button shown next to the message. */
  action?: SnackbarAction;
  /** Stays until dismissed or replaced instead of auto-dismissing. */
  persistent?: boolean;
}

interface SnackbarState {
  message: string | null;
  danger: boolean;
  action: SnackbarAction | null;
  persistent: boolean;
  /** Bumps on every show so an identical message still re-triggers the toast. */
  key: number;
  show: (message: string, options?: SnackbarOptions) => void;
  dismiss: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  message: null,
  danger: false,
  action: null,
  persistent: false,
  key: 0,
  show: (message, options) =>
    set((s) => ({
      message,
      danger: options?.danger ?? false,
      action: options?.action ?? null,
      persistent: options?.persistent ?? false,
      key: s.key + 1,
    })),
  dismiss: () => set({ message: null }),
}));

/** Imperative entry point usable outside React components. */
export function showSnackbar(message: string, options?: SnackbarOptions): void {
  useSnackbarStore.getState().show(message, options);
}
