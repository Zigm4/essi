import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListEmptyKind } from '../logic';
import { CaptureListShell } from './CaptureListShell';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  // PageScrollView reads prefers-reduced-motion; jsdom has no matchMedia.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderEmpty(emptyKind: ListEmptyKind, onClearFilters = () => undefined) {
  act(() =>
    root.render(
      <MemoryRouter>
        <CaptureListShell
          loading={false}
          error={undefined}
          errorFallback="Couldn't load your notes."
          searchPlaceholder="Search notes"
          search=""
          onSearchChange={() => undefined}
          allTags={[{ id: 't1', displayName: 'discord', name: 'discord', colorHex: null }]}
          selectedTagIds={new Set(['t1'])}
          onToggleTag={() => undefined}
          isEmpty
          emptyKind={emptyKind}
          onClearFilters={onClearFilters}
          emptyIcon={null}
          emptyTitleNone="No notes yet"
          emptyCaptionNone="Tap + to capture your first note."
        >
          {null}
        </CaptureListShell>
      </MemoryRouter>,
    ),
  );
}

function clearButton(): HTMLButtonElement | undefined {
  return [...host.querySelectorAll('button')].find((b) => b.textContent === 'Clear filters');
}

describe('CaptureListShell empty states', () => {
  it('says the tag filter hides everything and offers to clear it', () => {
    const onClear = vi.fn();
    renderEmpty('tags', onClear);
    expect(host.textContent).toContain('No matches');
    expect(host.textContent).toContain('Nothing matches your filters.');
    expect(host.textContent).not.toContain('No notes yet');
    act(() => clearButton()?.click());
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('keeps the plain "nothing saved" state when there is nothing to filter', () => {
    renderEmpty('none');
    expect(host.textContent).toContain('No notes yet');
    expect(host.textContent).toContain('Tap + to capture your first note.');
    expect(clearButton()).toBeUndefined();
  });

  it('keeps the search-only state', () => {
    renderEmpty('search');
    expect(host.textContent).toContain('Try a different search.');
    expect(clearButton()).toBeUndefined();
  });
});
