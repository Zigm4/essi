import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('useUnsavedChangesGuard', () => {
  it('does nothing while clean', () => {
    const push = vi.spyOn(window.history, 'pushState');
    act(() => root.render(<Harness onBack={() => undefined} />));
    expect(push).not.toHaveBeenCalled();
  });

  it('turns Back into a discard prompt while dirty and cleans up after', () => {
    const onBack = vi.fn();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    act(() => root.render(<Harness onBack={onBack} />));
    const before = window.history.length;

    act(() => setDirtyFromTest(true));
    expect(window.history.length).toBe(before + 1); // a same-URL guard entry
    expect((window.history.state as { essiGuard?: string }).essiGuard).toMatch(/^essi-guard-/);

    // Back pops the guard entry: the prompt shows and the guard is re-armed.
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect((window.history.state as { essiGuard?: string }).essiGuard).toMatch(/^essi-guard-/);

    // A reload / close asks the browser to confirm.
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    // Saved / discarded: the guard entry is popped again.
    act(() => setDirtyFromTest(false));
    expect(back).toHaveBeenCalledTimes(1);
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
