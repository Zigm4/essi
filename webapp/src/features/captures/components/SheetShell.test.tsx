import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SheetShell } from './SheetShell';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  // AppBackground reads prefers-reduced-motion; jsdom has no matchMedia.
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
  // ...and sizes its canvas with a ResizeObserver, which jsdom lacks too.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function saveButton(): HTMLButtonElement {
  return [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Save') as HTMLButtonElement;
}

describe('SheetShell save', () => {
  it('saves once on a double click while the save is in flight', async () => {
    let finish: () => void = () => undefined;
    const onSave = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    act(() =>
      root.render(
        <SheetShell title="New note" canSave dirty={false} onClose={() => undefined} onSave={onSave}>
          <p>body</p>
        </SheetShell>,
      ),
    );
    act(() => {
      saveButton().click();
      saveButton().click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveButton().disabled).toBe(true);

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(saveButton().disabled).toBe(false);
  });
});

describe('SheetShell and Back', () => {
  /** Lets the back stack's microtask, history traversals and React updates run. */
  async function settle() {
    await act(async () => {
      for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 5));
    });
  }

  const discardPrompt = () => document.querySelector('[role="alertdialog"][aria-label="Discard changes?"]');

  function renderShell(dirty: boolean, onClose: () => void) {
    act(() =>
      root.render(
        <SheetShell title="Edit note" canSave dirty={dirty} onClose={onClose} onSave={() => undefined}>
          <p>body</p>
        </SheetShell>,
      ),
    );
  }

  beforeEach(async () => {
    await settle();
    window.history.pushState({ key: 'captures', idx: 1 }, '', '#/captures');
  });

  afterEach(async () => {
    act(() => root.render(null));
    await settle();
  });

  it('closes a clean editor on Back, staying on the screen', async () => {
    const onClose = vi.fn();
    renderShell(false, onClose);
    await settle();
    window.history.back();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/captures');
  });

  it('asks before dropping unsaved changes on Back; Back again keeps editing', async () => {
    const onClose = vi.fn();
    renderShell(false, onClose);
    await settle();
    renderShell(true, onClose); // typed something
    await settle();

    window.history.back();
    await settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(discardPrompt()).not.toBeNull();

    window.history.back(); // closes the prompt only
    await settle();
    expect(discardPrompt()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/captures');

    // Escape goes through the same check.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(discardPrompt()).not.toBeNull();
    const discard = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Discard')!;
    act(() => discard.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
