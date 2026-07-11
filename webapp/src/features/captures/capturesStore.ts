import { create } from 'zustand';

/**
 * App-session state for Captures (spec §20). Held in memory (not persisted):
 * the segmented mode and the tag-filter selections survive navigation but reset
 * on a full reload. Search text is deliberately NOT here — it lives as local
 * component state so it clears whenever a list unmounts (autoDispose, spec §6).
 */

export type CapturesMode = 'notes' | 'links';

interface CapturesState {
  mode: CapturesMode;
  notesSelectedTags: Set<string>;
  linksSelectedTags: Set<string>;
  setMode: (mode: CapturesMode) => void;
  toggleNotesTag: (tagId: string) => void;
  toggleLinksTag: (tagId: string) => void;
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const useCapturesStore = create<CapturesState>((set) => ({
  mode: 'notes',
  notesSelectedTags: new Set<string>(),
  linksSelectedTags: new Set<string>(),
  setMode: (mode) => set({ mode }),
  toggleNotesTag: (tagId) =>
    set((s) => ({ notesSelectedTags: toggle(s.notesSelectedTags, tagId) })),
  toggleLinksTag: (tagId) =>
    set((s) => ({ linksSelectedTags: toggle(s.linksSelectedTags, tagId) })),
}));
