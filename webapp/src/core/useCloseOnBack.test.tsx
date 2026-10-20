import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBackStack, resetBackStackForTests } from './backStack';
import { useCloseOnBack } from './useCloseOnBack';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;
/** Stands in for the router's popstate listener (registered after the back stack's). */
let routerPops: ReturnType<typeof vi.fn<() => void>>;
let keySeq = 0;

function Overlay({ name, onClose }: { name: string; onClose: (name: string) => void }) {
  useCloseOnBack(true, () => onClose(name));
  return null;
}

let setOpenFromTest: (names: string[]) => void = () => undefined;

/** Opens the named overlays, nested in that order (the later one on top). */
function Stack({ initial, onClose }: { initial: string[]; onClose: (name: string) => void }) {
  const [open, setOpen] = useState(initial);
  setOpenFromTest = setOpen;
  const close = (name: string) => {
    onClose(name);
    setOpen((o) => o.filter((n) => n !== name));
  };
  return (
    <>
      {open.map((name) => (
        <Overlay key={name} name={name} onClose={close} />
      ))}
    </>
  );
}

/** Lets microtasks, history traversals (tasks) and React updates run. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 5));
  });
}

const marker = () => (window.history.state as { essiLayer?: { id: number } } | null)?.essiLayer;

async function back() {
  window.history.back();
  await settle();
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  installBackStack();
  resetBackStackForTests();
  // Router-like entries (HashRouter keeps a key and an index): a previous screen, then the page.
  window.history.replaceState({ key: 'previous', idx: 0 }, '', '#/tools');
  window.history.pushState({ key: `page${++keySeq}`, idx: 1 }, '', '#/tools/jobs');
  routerPops = vi.fn<() => void>();
  window.addEventListener('popstate', routerPops);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  await settle();
  window.removeEventListener('popstate', routerPops);
  host.remove();
});

describe('useCloseOnBack', () => {
  it('pushes one same-URL entry per open overlay, keeping the router state', async () => {
    const before = window.history.length;
    act(() => root.render(<Stack initial={['a']} onClose={() => undefined} />));
    await settle();
    expect(window.history.length).toBe(before + 1);
    expect(marker()).toBeDefined();
    expect(window.history.state).toMatchObject({ key: `page${keySeq}`, idx: 1 });
    expect(window.location.hash).toBe('#/tools/jobs');
  });

  it('Back closes the top-most overlay only, one at a time, unseen by the router', async () => {
    const closed: string[] = [];
    act(() => root.render(<Stack initial={['detail', 'share']} onClose={(n) => closed.push(n)} />));
    await settle();

    await back();
    expect(closed).toEqual(['share']);
    expect(marker()).toBeDefined(); // the detail's entry

    await back();
    expect(closed).toEqual(['share', 'detail']);
    expect(marker()).toBeUndefined();
    expect(window.history.state).toMatchObject({ key: `page${keySeq}` });
    expect(routerPops).not.toHaveBeenCalled();

    // Nothing left open: the next Back is the router's.
    await back();
    expect(routerPops).toHaveBeenCalledTimes(1);
  });

  it('closing from the UI removes its entry without navigating', async () => {
    const closed: string[] = [];
    act(() => root.render(<Stack initial={['detail', 'share']} onClose={(n) => closed.push(n)} />));
    await settle();
    const shareEntry = marker(); // on top of the detail's
    expect(shareEntry).toBeDefined();

    act(() => setOpenFromTest(['detail'])); // Share's close button
    await settle();
    expect(marker()).toBeDefined();
    expect(marker()!.id).not.toBe(shareEntry!.id); // back on the detail's entry
    expect(routerPops).not.toHaveBeenCalled();

    // Back now closes the detail (no do-nothing entry left behind).
    await back();
    expect(closed).toEqual(['detail']);
    expect(marker()).toBeUndefined();
    expect(routerPops).not.toHaveBeenCalled();
  });

  it('reuses the entry when one overlay closes as another opens (history row → detail)', async () => {
    act(() => root.render(<Stack initial={['history']} onClose={() => undefined} />));
    await settle();
    const length = window.history.length;
    act(() => setOpenFromTest(['detail']));
    await settle();
    expect(window.history.length).toBe(length);
    expect(marker()).toBeDefined();
    expect(routerPops).not.toHaveBeenCalled();
  });

  it('Escape closes the top-most overlay only', async () => {
    const closed: string[] = [];
    act(() => root.render(<Stack initial={['detail', 'share']} onClose={(n) => closed.push(n)} />));
    await settle();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(closed).toEqual(['share']);
    await settle();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(closed).toEqual(['share', 'detail']);
  });

  it('carries a router replace made while open down to the page entry', async () => {
    act(() => root.render(<Stack initial={['filters']} onClose={() => undefined} />));
    await settle();
    // The router writes the new filters (a replace) as the sheet closes.
    act(() => setOpenFromTest([]));
    window.history.replaceState({ key: 'filtered', idx: 1 }, '', '#/tools/jobs?status=done');
    await settle();
    expect(window.location.hash).toBe('#/tools/jobs?status=done');
    expect(window.history.state).toEqual({ key: 'filtered', idx: 1 });
    expect(routerPops).not.toHaveBeenCalled();
  });

  it('lets a route pushed from an open overlay take its place', async () => {
    act(() => root.render(<Stack initial={['detail']} onClose={() => undefined} />));
    await settle();
    const length = window.history.length;
    // "Track this object": the router pushes the Tracker while the detail is up.
    window.history.pushState({ key: 'tracker', idx: 2 }, '', '#/tools/tracker');
    act(() => root.render(<Stack initial={[]} onClose={() => undefined} />));
    await settle();
    expect(window.history.length).toBe(length); // took the detail's entry
    expect(window.location.hash).toBe('#/tools/tracker');

    // Back from the Tracker returns straight to the page, through the router.
    await back();
    expect(window.location.hash).toBe('#/tools/jobs');
    expect(window.history.state).toMatchObject({ key: `page${keySeq}` });
    expect(routerPops).toHaveBeenCalledTimes(1);
  });
});

describe('useUnsavedChangesGuard with overlays', () => {
  let setDirtyFromTest: (dirty: boolean) => void = () => undefined;
  let setPickerFromTest: (open: boolean) => void = () => undefined;

  function Editor({ onClose, onBackAttempt }: { onClose: (n: string) => void; onBackAttempt: () => void }) {
    const [dirty, setDirty] = useState(false);
    const [picker, setPicker] = useState(false);
    setDirtyFromTest = setDirty;
    setPickerFromTest = setPicker;
    useCloseOnBack(true, () => onClose('editor'));
    useUnsavedChangesGuard(dirty, onBackAttempt);
    return picker ? <Overlay name="picker" onClose={(n) => { onClose(n); setPicker(false); }} /> : null;
  }

  it('Back closes a picker over a dirty editor, then asks before dropping the edits', async () => {
    const closed: string[] = [];
    const onBackAttempt = vi.fn<() => void>();
    act(() => root.render(<Editor onClose={(n) => closed.push(n)} onBackAttempt={onBackAttempt} />));
    await settle();
    act(() => setDirtyFromTest(true));
    await settle();
    act(() => setPickerFromTest(true));
    await settle();

    await back();
    expect(closed).toEqual(['picker']);
    expect(onBackAttempt).not.toHaveBeenCalled();

    await back();
    expect(onBackAttempt).toHaveBeenCalledTimes(1);
    expect(closed).toEqual(['picker']); // the editor stays

    await back(); // the guard came back: still asks
    expect(onBackAttempt).toHaveBeenCalledTimes(2);

    // Saved: the guard's entry goes, Back closes the clean editor.
    act(() => setDirtyFromTest(false));
    await settle();
    await back();
    expect(closed).toEqual(['picker', 'editor']);
    expect(routerPops).not.toHaveBeenCalled();
  });
});
