import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateDocument } from '../data/parse';
import type { MapDocument } from '../model/types';
import { MapCanvas } from './MapCanvas';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  rect(): void {}
  roundRect(): void {}
}

class FakeResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

/** Last `translate(tx, ty)` of a grid/flat frame = the current pan offset. */
let lastTranslate: [number, number] = [NaN, NaN];

function fakeContext(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { filter: 'none' };
  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...args: number[]) => unknown> = {
    translate: (x, y) => {
      lastTranslate = [x, y];
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 12 }),
  };
  return new Proxy(state, {
    get: (target, key) => {
      if (typeof key === 'string' && key in methods) return methods[key];
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function loadMars(): MapDocument {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/mars.map.json`);
  const res = validateDocument(JSON.parse(buf.toString('utf-8')), buf.byteLength);
  if (!res.ok) throw new Error(res.message);
  return res.value;
}

const mars = loadMars();
let root: Root;
let host: HTMLDivElement;
let onSelect: ReturnType<typeof vi.fn<(id: string | null) => void>>;

function canvas(): HTMLCanvasElement {
  const c = host.querySelector('canvas');
  if (c === null) throw new Error('no canvas');
  return c;
}

function pointer(type: string, id: number, x: number, y: number): void {
  act(() => {
    canvas().dispatchEvent(
      new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }),
    );
  });
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('Path2D', FakePath2D);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext() as never,
  );
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  });
  lastTranslate = [NaN, NaN];
  onSelect = vi.fn<(id: string | null) => void>();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <MapCanvas
        doc={mars}
        mode="grid"
        selectedId={null}
        onSelect={onSelect}
        dimmed={new Set()}
        hideDimmed={false}
        focusZoneId={null}
        focusNonce={0}
        backgroundBlob={null}
      />,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MapCanvas gestures', () => {
  it('does not jump when one finger lifts after a pinch', () => {
    pointer('pointerdown', 1, 100, 100); // finger A
    pointer('pointerdown', 2, 200, 200); // finger B
    pointer('pointermove', 2, 220, 220); // pinch out
    const [tx, ty] = lastTranslate;
    expect(Number.isFinite(tx)).toBe(true);

    pointer('pointerup', 1, 100, 100); // lift A, keep B down
    pointer('pointermove', 2, 221, 221); // B moves 1 px
    // The view pans by the finger's 1 px, not by B − A's first position (121 px).
    expect(lastTranslate[0] - tx).toBeCloseTo(1, 5);
    expect(lastTranslate[1] - ty).toBeCloseTo(1, 5);
  });

  it('does not jump when the other finger is the one lifted', () => {
    pointer('pointerdown', 1, 100, 100);
    pointer('pointerdown', 2, 200, 200);
    pointer('pointermove', 1, 80, 80); // A drifts during the pinch
    const [tx, ty] = lastTranslate;
    pointer('pointerup', 2, 200, 200);
    pointer('pointermove', 1, 82, 81);
    expect(lastTranslate[0] - tx).toBeCloseTo(2, 5);
    expect(lastTranslate[1] - ty).toBeCloseTo(1, 5);
  });

  it('selects the zone under a tap', () => {
    pointer('pointerdown', 1, 200, 400);
    pointer('pointerup', 1, 200, 400);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatch(/^z\d+$/);
  });

  it('does not treat pointercancel as a tap', () => {
    pointer('pointerdown', 1, 200, 400);
    pointer('pointercancel', 1, 200, 400);
    expect(onSelect).not.toHaveBeenCalled();
    // The gesture is fully released: the next real tap still selects.
    pointer('pointerdown', 2, 200, 400);
    pointer('pointerup', 2, 200, 400);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
