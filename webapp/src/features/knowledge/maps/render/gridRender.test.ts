import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateDocument } from '../data/parse';
import type { MapDocument } from '../model/types';
import { buildGridRender, drawGridTable, gridHitTest, type GridRender } from './gridRender';

/** jsdom has no Path2D. */
class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  rect(): void {}
}

/** A canvas context that records every `fillText`, with a monospace measure. */
function textContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const state: Record<string | symbol, unknown> = { filter: 'none' };
  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    fillText: (text: unknown) => {
      texts.push(String(text));
    },
    createLinearGradient: () => gradient,
    measureText: (text: unknown) => ({ width: String(text).length * 7.8 }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      if (typeof key === 'string' && key in methods) return methods[key];
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

function loadGrid(id: string): GridRender {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/${id}.map.json`);
  const res = validateDocument(JSON.parse(buf.toString('utf-8')), buf.byteLength);
  if (!res.ok) throw new Error(res.message);
  const doc: MapDocument = res.value;
  const render = buildGridRender(doc);
  if (render === null) throw new Error(`${id} is a grid map`);
  return render;
}

const g = globalThis as { Path2D?: unknown };
const realPath2D = g.Path2D;
beforeAll(() => {
  g.Path2D = FakePath2D;
});
afterAll(() => {
  g.Path2D = realPath2D;
});

describe('gridHitTest', () => {
  const venus = loadGrid('venus'); // 60×30 cells of 96×64
  const w = venus.canvasWidth;
  const h = venus.canvasHeight;

  it('hits the cell under the point, edges included', () => {
    expect(gridHitTest(venus, { x: 0, y: 0 })).toBe('z1');
    expect(gridHitTest(venus, { x: 95.9, y: 63.9 })).toBe('z1');
    expect(gridHitTest(venus, { x: 96, y: 0 })).toBe('z2');
    expect(gridHitTest(venus, { x: w - 0.1, y: h - 0.1 })).toBe('z1800');
  });

  it('a point in the margin around the table hits nothing', () => {
    // Before: clamped onto the nearest edge cell (z1 / z1800).
    for (const p of [
      { x: -50, y: -50 },
      { x: -0.1, y: 10 },
      { x: 10, y: -0.1 },
      { x: w, y: 10 },
      { x: 10, y: h },
      { x: w + 500, y: h + 500 },
      { x: Number.NaN, y: 10 },
    ]) {
      expect(gridHitTest(venus, p), JSON.stringify(p)).toBeNull();
    }
  });
});

describe('grid cell names', () => {
  it('wrap onto two lines without dropping words, and end with … when cut', () => {
    const mars = loadGrid('mars');
    const { ctx, texts } = textContext();
    drawGridTable(ctx, mars, { scale: mars.nameLodScale, dimmed: new Set() });
    // "Rustwind Generator 279": the cut second line shows it.
    expect(texts).toContain('Generator…');
    expect(texts).not.toContain('Generator');
  });

  it('show the whole name when two lines are enough', () => {
    const io = loadGrid('io');
    const { ctx, texts } = textContext();
    drawGridTable(ctx, io, { scale: io.nameLodScale, dimmed: new Set() });
    // "Kings Fort" fits one line; "Bosphorus Trade Hub" needs the whole 2nd
    // line (before: "Bosphorus / Trade").
    expect(texts).toContain('Kings Fort');
    expect(texts).toContain('Bosphorus');
    expect(texts).toContain('Trade Hub');
    expect(texts).not.toContain('Trade');
  });
});
