/**
 * Flat 2D map render model + hit index + background-decode strategy
 * (maps spec §13). `buildFlatMapRender` is pure (no canvas) and unit-testable;
 * the painter (components/FlatViewport) consumes it.
 */

import { sanitizeTheme, zoneTheme, type MapTheme } from '../model/theme';
import type { CanvasPoint, CanvasSize, MapDocument } from '../model/types';

export const MIN_LABEL_SCREEN_PX = 12;
const BG_BASE_DECODE_CAP = 2048;
const BG_MAX_DECODE_CAP = 4096;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function rectCenter(r: Rect): CanvasPoint {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function rectIsEmpty(r: Rect): boolean {
  return r.w <= 0 || r.h <= 0;
}

export interface FlatRenderItem {
  readonly zoneId: string;
  readonly kind: 'polygon' | 'marker' | 'none';
  readonly theme: MapTheme;
  /** Polygon rings (rings with < 3 points already dropped); ring 0 = outline. */
  readonly rings: readonly (readonly CanvasPoint[])[];
  readonly markerCenter: CanvasPoint | null;
  readonly markerHitRadius: number;
  readonly bounds: Rect;
  readonly label: { readonly text: string; readonly anchor: CanvasPoint } | null;
}

export interface FlatRender {
  readonly theme: MapTheme;
  readonly canvasSize: CanvasSize;
  readonly fontSize: number;
  readonly markerRadius: number;
  readonly labelLodScale: number;
  readonly items: readonly FlatRenderItem[];
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function polygonBounds(rings: readonly (readonly CanvasPoint[])[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function buildFlatMapRender(doc: MapDocument): FlatRender {
  const theme = sanitizeTheme(doc.theme);
  const canvasSize = doc.canvas ?? { width: 1024, height: 1024 };
  const shortest = Math.min(canvasSize.width, canvasSize.height);
  const fontSize = clamp(shortest * 0.018, 22, 96);
  const markerRadius = fontSize * 0.65;
  const labelLodScale = MIN_LABEL_SCREEN_PX / fontSize;

  const items: FlatRenderItem[] = doc.zones.map((zone) => {
    const t = zoneTheme(theme, zone.themeOverride);
    const geom = zone.geometry;
    let kind: FlatRenderItem['kind'] = 'none';
    let rings: (readonly CanvasPoint[])[] = [];
    let markerCenter: CanvasPoint | null = null;
    let markerHitRadius = 0;
    let bounds: Rect = { x: 0, y: 0, w: 0, h: 0 };

    if (geom !== null && geom.kind === 'polygon') {
      rings = geom.rings.filter((r) => r.length >= 3);
      if (rings.length > 0) {
        kind = 'polygon';
        bounds = polygonBounds(rings);
      }
    } else if (geom !== null && geom.kind === 'marker') {
      kind = 'marker';
      markerCenter = geom.at;
      markerHitRadius = geom.hitRadius;
      bounds = {
        x: geom.at.x - markerRadius,
        y: geom.at.y - markerRadius,
        w: markerRadius * 2,
        h: markerRadius * 2,
      };
    }

    let label: FlatRenderItem['label'] = null;
    if (zone.name.length > 0 && kind !== 'none') {
      const anchor = zone.labelAnchor ?? markerCenter ?? rectCenter(bounds);
      label = { text: zone.name, anchor };
    }

    return { zoneId: zone.id, kind, theme: t, rings, markerCenter, markerHitRadius, bounds, label };
  });

  return { theme, canvasSize, fontSize, markerRadius, labelLodScale, items };
}

// --- Hit testing (§13.5) ----------------------------------------------------

function pointInPolygonEvenOdd(rings: readonly (readonly CanvasPoint[])[], p: CanvasPoint): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = ring[i];
      const b = ring[j];
      const intersects =
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (intersects) inside = !inside;
    }
  }
  return inside;
}

/** Precomputed hit index; topmost (last drawn) wins (§13.5). */
export class ZoneHitIndex {
  private readonly items: readonly FlatRenderItem[];

  constructor(render: FlatRender) {
    this.items = render.items;
  }

  hitTest(point: CanvasPoint, scale: number): string | null {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.kind === 'polygon') {
        if (rectIsEmpty(item.bounds)) continue;
        const b = item.bounds;
        if (point.x < b.x || point.x > b.x + b.w || point.y < b.y || point.y > b.y + b.h) continue;
        if (pointInPolygonEvenOdd(item.rings, point)) return item.zoneId;
      } else if (item.kind === 'marker' && item.markerCenter !== null) {
        const effective = scale <= 0 ? item.markerHitRadius : item.markerHitRadius / scale;
        const dx = point.x - item.markerCenter.x;
        const dy = point.y - item.markerCenter.y;
        if (dx * dx + dy * dy <= effective * effective) return item.zoneId;
      }
    }
    return null;
  }
}

/** Constrained background decode width (§13.6) — never above the source. */
export function backgroundDecodeWidth(canvasWidth: number, scale: number): number {
  const desired = Math.ceil(canvasWidth * scale);
  const capped = clamp(desired, 1, BG_MAX_DECODE_CAP);
  const target = Math.max(capped, BG_BASE_DECODE_CAP);
  const bounded = Math.min(target, Math.ceil(canvasWidth));
  return Math.max(bounded, 1);
}
