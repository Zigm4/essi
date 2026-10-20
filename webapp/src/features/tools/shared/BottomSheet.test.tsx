import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let appRoot: HTMLDivElement;
let opener: HTMLButtonElement;
let root: Root;
let onClose: ReturnType<typeof vi.fn<() => void>>;

function render(open: boolean, footer?: React.ReactNode) {
  act(() => {
    root.render(
      <BottomSheet open={open} onClose={onClose} ariaLabel="Test sheet" footer={footer}>
        <button type="button">Inside</button>
      </BottomSheet>,
    );
  });
}

beforeAll(() => {
  // jsdom has PointerEvent but no pointer capture.
  if (!('setPointerCapture' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {} });
  }
});

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  onClose = vi.fn<() => void>();
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  opener = document.createElement('button');
  opener.textContent = 'Open';
  appRoot.appendChild(opener);
  document.body.appendChild(appRoot);
  root = createRoot(document.createElement('div'));
  opener.focus();
});

afterEach(() => {
  act(() => root.unmount());
  appRoot.remove();
});

describe('BottomSheet focus handling', () => {
  it('moves focus into the panel and makes the app inert while open', () => {
    render(true);
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(appRoot.hasAttribute('inert')).toBe(true);
  });

  it('releases the app and gives focus back to the opener on close', () => {
    render(true);
    render(false);
    expect(appRoot.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe('BottomSheet footer', () => {
  it('renders no pinned bar for an empty footer (null / false)', () => {
    for (const footer of [null, false, undefined]) {
      render(true, footer);
      expect(document.querySelector('[role="dialog"]')!.children.length).toBe(2); // handle + body
      render(false);
    }
    render(true, <button type="button">Apply</button>);
    expect(document.querySelector('[role="dialog"]')!.children.length).toBe(3);
  });
});

describe('BottomSheet dismissal', () => {
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const handleRow = () => dialog().firstElementChild as HTMLElement;
  const grip = () => handleRow().querySelector('button')!;

  function pointer(target: Element, type: string, x: number, y: number) {
    act(() => {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: x, clientY: y }),
      );
    });
  }

  /** Press on `from`, move by (dx, dy), then release (or cancel). */
  function gesture(from: Element, dx: number, dy: number, end: 'pointerup' | 'pointercancel' = 'pointerup') {
    pointer(from, 'pointerdown', 100, 10);
    if (dx !== 0 || dy !== 0) pointer(handleRow(), 'pointermove', 100 + dx, 10 + dy);
    pointer(handleRow(), end, 100 + dx, 10 + dy);
  }

  it.each([
    ['an upward drag', 0, -100, 'pointerup'],
    ['a sideways drag', 150, 2, 'pointerup'],
    ['a diagonal drag that is more sideways than down', 200, 150, 'pointerup'],
    ['a short drag down', 0, 50, 'pointerup'],
    ['a pointercancel without movement', 0, 0, 'pointercancel'],
    ['a pointercancel after an upward drag', 0, -100, 'pointercancel'],
    ['a pointercancel after a short drag down', 0, 50, 'pointercancel'],
    ['a pointercancel after a long drag down', 0, 200, 'pointercancel'],
  ] as const)('stays open on %s', (_label, dx, dy, end) => {
    render(true);
    gesture(grip(), dx, dy, end);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().style.transform).toBe(''); // snapped back
  });

  it('follows the finger while dragging down', () => {
    render(true);
    pointer(grip(), 'pointerdown', 100, 10);
    pointer(handleRow(), 'pointermove', 100, 70);
    expect(dialog().style.transform).toBe('translateY(60px)');
    pointer(handleRow(), 'pointermove', 100, -40);
    expect(dialog().style.transform).toBe(''); // never above its resting place
  });

  it('closes on a clear drag down past the threshold, from anywhere in the top band', () => {
    render(true);
    gesture(handleRow(), 30, 150);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap on the handle itself', () => {
    render(true);
    gesture(grip(), 2, 3);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a tap elsewhere in the top band', () => {
    render(true);
    gesture(handleRow(), 0, 0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on keyboard activation of the handle, Escape and the scrim', () => {
    render(true);
    act(() => grip().click()); // keyboard / AT activation: detail 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('ignores a pointer click on the handle (its tap is handled by the gesture)', () => {
    render(true);
    act(() => {
      grip().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('forgets a drag cut short by closing, so the next open responds', () => {
    render(true);
    pointer(grip(), 'pointerdown', 100, 10);
    pointer(handleRow(), 'pointermove', 100, 60);
    render(false); // e.g. closed by Escape mid-drag
    render(true);
    expect(dialog().style.transform).toBe('');
    gesture(grip(), 0, 0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet and Back', () => {
  /** Lets the back stack's microtask, history traversals and React updates run. */
  async function settle() {
    await act(async () => {
      for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 5));
    });
  }

  let onCloseInner: ReturnType<typeof vi.fn<() => void>>;

  /** A Share sheet opened from inside a job sheet, both portaled to <body>. */
  function renderNested(outer: boolean, inner: boolean) {
    act(() => {
      root.render(
        <BottomSheet open={outer} onClose={onClose} ariaLabel="Job details">
          <button type="button">Share</button>
          <BottomSheet open={inner} onClose={onCloseInner} ariaLabel="Share">
            <button type="button">Copy link</button>
          </BottomSheet>
        </BottomSheet>,
      );
    });
  }

  const sheet = (label: string) => document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]`);

  beforeEach(async () => {
    onCloseInner = vi.fn<() => void>();
    await settle(); // the sheets of earlier tests finish taking their entries back
    window.history.pushState({ key: 'jobs', idx: 1 }, '', '#/tools/jobs');
  });

  afterEach(async () => {
    renderNested(false, false);
    await settle();
  });

  it('closes the top-most sheet on Back, one at a time', async () => {
    renderNested(true, true);
    await settle();
    // Only the top sheet is reachable: the job sheet under it is inert too.
    expect(sheet('Job details')!.parentElement!.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(sheet('Share'));

    window.history.back();
    await settle();
    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    renderNested(true, false);
    await settle();
    expect(sheet('Job details')!.parentElement!.hasAttribute('inert')).toBe(false);
    expect(window.location.hash).toBe('#/tools/jobs');

    window.history.back();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the top-most sheet on Escape', async () => {
    renderNested(true, true);
    await settle();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
