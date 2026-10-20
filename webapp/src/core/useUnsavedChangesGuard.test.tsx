import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBackStack, resetBackStackForTests } from './backStack';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;
let setDirtyFromTest: (dirty: boolean) => void = () => undefined;

function Harness({ onBack }: { onBack: () => void }) {
  const [dirty, setDirty] = useState(false);
  setDirtyFromTest = setDirty;
  useUnsavedChangesGuard(dirty, onBack);
  return null;
}

/** Lets the back stack's microtask, history traversals and React updates run. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 5));
  });
}

const guardMarker = () => (window.history.state as { essiLayer?: unknown } | null)?.essiLayer;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  installBackStack();
  resetBackStackForTests();
  window.history.pushState({ key: 'editor', idx: 1 }, '', '#/hangar');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  await settle();
  host.remove();
  vi.restoreAllMocks();
});

describe('useUnsavedChangesGuard', () => {
  it('does nothing while clean', async () => {
    const length = window.history.length;
    act(() => root.render(<Harness onBack={() => undefined} />));
    await settle();
    expect(window.history.length).toBe(length);
  });

  it('turns Back into a discard prompt while dirty and cleans up after', async () => {
    const onBack = vi.fn();
    act(() => root.render(<Harness onBack={onBack} />));
    const before = window.history.length;

    act(() => setDirtyFromTest(true));
    await settle();
    expect(window.history.length).toBe(before + 1); // a same-URL guard entry
    expect(guardMarker()).toBeDefined();
    expect(window.location.hash).toBe('#/hangar');

    // Back pops the guard entry: the prompt shows and the guard is re-armed.
    window.history.back();
    await settle();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(guardMarker()).toBeDefined();
    expect(window.location.hash).toBe('#/hangar');

    // A reload / close asks the browser to confirm.
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    // Saved / discarded: the guard entry is popped again.
    act(() => setDirtyFromTest(false));
    await settle();
    expect(guardMarker()).toBeUndefined();
    expect(window.history.state).toMatchObject({ key: 'editor', idx: 1 });
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
