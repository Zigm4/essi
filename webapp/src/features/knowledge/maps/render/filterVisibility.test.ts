import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateDocument } from '../data/parse';
import { orientationFromLatLon } from '../model/orientation';
import type { MapDocument } from '../model/types';
import { buildGridRender, drawGridTable } from './gridRender';
import { buildSphereRender, drawGlobe } from './sphereRender';

/** jsdom has no Path2D: a stub that only counts its sub-paths. */
class FakePath2D {
  subpaths = 0;
  moveTo(): void {
    this.subpaths += 1;
  }
  lineTo(): void {}
  closePath(): void {}
  rect(): void {
    this.subpaths += 1;
  }
}

/** A canvas context that records the fillStyle of every fill. */
function recordingContext(): { ctx: CanvasRenderingContext2D; fills: string[] } {
  const fills: string[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: '', filter: 'none' };
  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    fill: () => {
      fills.push(String(state.fillStyle));
    },
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: (text: unknown) => ({ width: String(text).length * 6 }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      if (typeof key === 'string' && key in methods) return methods[key];
      if (key in target) return target[key];
      return () => {}; // every other drawing call is a no-op
    },
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

function loadSeedDoc(id: string): MapDocument {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/${id}.map.json`);
  const res = validateDocument(JSON.parse(buf.toString('utf-8')), buf.byteLength);
  if (!res.ok) throw new Error(res.message);
  return res.value;
}

/** Same rule as MapDetailView: zones not matching the filter are dimmed. */
function dimmedFor(doc: MapDocument, key: string, value: string): Set<string> {
  return new Set(doc.zones.filter((z) => z.fields[key] !== value).map((z) => z.id));
}

const g = globalThis as { Path2D?: unknown };
const realPath2D = g.Path2D;
beforeAll(() => {
  g.Path2D = FakePath2D;
});
afterAll(() => {
  g.Path2D = realPath2D;
});

describe('filter matches without a themeOverride', () => {
  const venus = loadSeedDoc('venus');
  // Venus: all 1754 "Uncharted" zones are plain cells (no override, no geometry).
  const uncharted = dimmedFor(venus, 'status', 'Uncharted');
  const plainMatches = venus.zones.filter((z) => z.fields.status === 'Uncharted');

  it('Venus "Uncharted" really is the bodiless case', () => {
    expect(plainMatches.length).toBe(1754);
    expect(plainMatches.every((z) => z.themeOverride === null && z.geometry === null)).toBe(true);
  });

  it('are painted on the globe when a filter is active', () => {
    const render = buildSphereRender(venus);
    const { ctx, fills } = recordingContext();
    drawGlobe(ctx, {
      render,
      width: 800,
      height: 800,
      orientation: orientationFromLatLon({ lat: 0, lon: 0 }),
      zoom: 1,
      selectedId: null,
      dimmed: uncharted,
      hideDimmed: true,
    });
    // paintPolygonZone fills zones at alpha 0.42; before the fix nothing matched.
    const zoneFills = fills.filter((f) => f.endsWith(', 0.42)'));
    expect(zoneFills.length).toBeGreaterThan(0);
  });

  it('are not painted on the globe without a filter', () => {
    const render = buildSphereRender(venus);
    const { ctx, fills } = recordingContext();
    drawGlobe(ctx, {
      render,
      width: 800,
      height: 800,
      orientation: orientationFromLatLon({ lat: 0, lon: 0 }),
      zoom: 1,
      selectedId: null,
      dimmed: new Set(),
      hideDimmed: false,
    });
    // Only the explored zones with a body (front hemisphere) get a fill.
    const zoneFills = fills.filter((f) => f.endsWith(', 0.42)'));
    expect(zoneFills.length).toBeLessThanOrEqual(46);
  });

  it('get a tile in the grid view when a filter is active', () => {
    const render = buildGridRender(venus);
    if (render === null) throw new Error('venus is a grid map');
    const tile = 'rgba(201, 162, 94, 0.62)'; // Venus base zoneFill at full tile alpha
    const draw = (filterActive: boolean): number => {
      const { ctx, fills } = recordingContext();
      drawGridTable(ctx, render, { scale: 1, dimmed: uncharted, filterActive });
      return fills.filter((f) => f === tile).length;
    };
    expect(draw(true)).toBe(1754);
    expect(draw(false)).toBe(0); // no filter flag: uncharted cells stay bare
  });
});
