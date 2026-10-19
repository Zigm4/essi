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
  return [...host.querySelectorAll('button')].find((b) => b.textContent === 'Save') as HTMLButtonElement;
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
