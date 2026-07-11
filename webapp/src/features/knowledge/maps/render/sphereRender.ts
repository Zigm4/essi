/**
 * Globe (sphere) render model, non-grid hit index, and the Canvas-2D painter
 * (maps spec §14). `buildSphereRender` is pure; `drawGlobe` is called per rAF
 * frame by components/GlobeViewport. Picking for grid docs is analytic (§14.4);
 * non-grid docs use `SphereHitIndex`.
 */

import {
  cellCenter,
  gridCellAt,
  worldVec,
  type GeoPoint,
  type MapGrid,
} from '../model/geo';
import { rotate, type Quat } from '../model/quaternion';
import {
  capRing,
  gridCellRing,
  pointInSphericalCap,
  pointInSphericalPolygon,
  ringCentroid,
  tessellateRing,
} from '../model/sphereGeometry';
import { colorAlpha, lerpColor, sanitizeTheme, zoneTheme, type MapColor, type MapTheme } from '../model/theme';
import type { MapDocument, MapZone } from '../model/types';
import { globeCenter, globeRadius, type ScreenPoint } from '../model/projection';
import { drawCenteredLabel } from './labels';
import { paintPolygonZone } from './paintOps';

export const SPHERE_LABEL_FONT_SIZE = 26;
const LABEL_MIN_RADIUS = 120;
const GRATICULE_STEP_DEG = 4;
const PLACEHOLDER = /^Zone\s+\d+$/;

function isLabelWorthyGridZone(zone: MapZone): boolean {
  return zone.themeOverride !== null || (zone.name.trim().length > 0 && !PLACEHOLDER.test(zone.name.trim()));
}

export interface SphereRenderItem {
  readonly zoneId: string;
  readonly theme: MapTheme;
  readonly rings: readonly (readonly GeoPoint[])[];
  readonly hasBody: boolean;
  readonly centroid: GeoPoint;
  readonly label: string | null;
  readonly gridCell: { readonly col: number; readonly row: number } | null;
}

export interface SphereRender {
  readonly theme: MapTheme;
  readonly labelFontSize: number;
  readonly items: readonly SphereRenderItem[];
  readonly isGrid: boolean;
  readonly grid: MapGrid | null;
  readonly gridZoneIdByCell: (string | null)[] | null;
  readonly gridPosById: ReadonlyMap<string, { col: number; row: number }>;
  readonly graticule: readonly (readonly GeoPoint[])[] | null;
}

function buildGraticule(grid: MapGrid): GeoPoint[][] {
  const lonStep = 360 / grid.cols;
  const latStep = 180 / grid.rows;
  const lines: GeoPoint[][] = [];
  const lats: number[] = [];
  for (let lat = -89.5; lat < 89.5; lat += GRATICULE_STEP_DEG) lats.push(lat);
  lats.push(89.5);
  // Meridians (one per column boundary; the ±180 seam is one line).
  for (let i = 0; i < grid.cols; i++) {
    const lon = -180 + i * lonStep;
    lines.push(lats.map((lat) => ({ lon, lat })));
  }
  // Interior parallels.
  const lons: number[] = [];
  for (let lon = -180; lon < 180; lon += GRATICULE_STEP_DEG) lons.push(lon);
  lons.push(180);
  for (let r = 1; r < grid.rows; r++) {
    const lat = Math.max(-89.5, Math.min(89.5, 90 - r * latStep));
    lines.push(lons.map((lon) => ({ lon, lat })));
  }
  return lines;
}

export function buildSphereRender(doc: MapDocument): SphereRender {
  const theme = sanitizeTheme(doc.theme);
  const grid = doc.grid;
  const items: SphereRenderItem[] = [];
  const gridPosById = new Map<string, { col: number; row: number }>();

  if (grid === null) {
    for (const zone of doc.zones) {
      const geom = zone.geometry;
      if (geom === null) continue;
      if (geom.kind === 'sphericalPolygon') {
        const rings = geom.rings.map((r) => tessellateRing(r));
        if (rings.length === 0 || rings[0].length < 3) continue;
        items.push({
          zoneId: zone.id,
          theme: zoneTheme(theme, zone.themeOverride),
          rings,
          hasBody: true,
          centroid: ringCentroid(rings[0]),
          label: zone.name.length > 0 ? zone.name : null,
          gridCell: null,
        });
      } else if (geom.kind === 'sphericalCap' && geom.radiusDeg > 0) {
        items.push({
          zoneId: zone.id,
          theme: zoneTheme(theme, zone.themeOverride),
          rings: [capRing(geom.center, geom.radiusDeg)],
          hasBody: true,
          centroid: geom.center,
          label: zone.name.length > 0 ? zone.name : null,
          gridCell: null,
        });
      }
    }
    return {
      theme,
      labelFontSize: SPHERE_LABEL_FONT_SIZE,
      items,
      isGrid: false,
      grid: null,
      gridZoneIdByCell: null,
      gridPosById,
      graticule: null,
    };
  }

  // Grid documents.
  const gridZoneIdByCell: (string | null)[] = new Array(grid.cols * grid.rows).fill(null);
  for (const zone of doc.zones) {
    const pos = zone.gridPos;
    if (pos !== null) {
      gridPosById.set(zone.id, pos);
      gridZoneIdByCell[pos.row * grid.cols + pos.col] = zone.id;
    }
    const geom = zone.geometry;
    const explicit =
      geom !== null && (geom.kind === 'sphericalPolygon' || geom.kind === 'sphericalCap');
    const labelWorthy = isLabelWorthyGridZone(zone);
    const hasBody = explicit || (pos !== null && zone.themeOverride !== null);
    if (!hasBody && !labelWorthy) continue; // graticule shows its cell

    let rings: (readonly GeoPoint[])[] = [];
    let centroid: GeoPoint;
    if (explicit && geom !== null && geom.kind === 'sphericalPolygon') {
      rings = geom.rings.map((r) => tessellateRing(r));
      centroid = rings.length > 0 && rings[0].length >= 3 ? ringCentroid(rings[0]) : { lon: 0, lat: 0 };
    } else if (explicit && geom !== null && geom.kind === 'sphericalCap') {
      rings = [capRing(geom.center, geom.radiusDeg)];
      centroid = geom.center;
    } else if (pos !== null) {
      if (hasBody) rings = [gridCellRing(grid, pos.col, pos.row)];
      centroid = cellCenter(grid, pos.col, pos.row);
    } else {
      centroid = { lon: 0, lat: 0 };
    }

    items.push({
      zoneId: zone.id,
      theme: zoneTheme(theme, zone.themeOverride),
      rings,
      hasBody,
      centroid,
      label: labelWorthy && zone.name.length > 0 ? zone.name : null,
      gridCell: pos,
    });
  }

  return {
    theme,
    labelFontSize: SPHERE_LABEL_FONT_SIZE,
    items,
    isGrid: true,
    grid,
    gridZoneIdByCell,
    gridPosById,
    graticule: buildGraticule(grid),
  };
}

/** Geographic anchor of a zone (grid zones use the cell centre) for deep links. */
export function zoneGeoAnchor(doc: MapDocument, zoneId: string): GeoPoint | null {
  const zone = doc.zones.find((z) => z.id === zoneId);
  if (zone === undefined) return null;
  if (doc.grid !== null && zone.gridPos !== null) {
    return cellCenter(doc.grid, zone.gridPos.col, zone.gridPos.row);
  }
  const geom = zone.geometry;
  if (geom !== null && geom.kind === 'sphericalPolygon' && geom.rings.length > 0) {
    return ringCentroid(tessellateRing(geom.rings[0]));
  }
  if (geom !== null && geom.kind === 'sphericalCap') return geom.center;
  return null;
}

// --- Non-grid hit index (§14.8) ---------------------------------------------

interface HitEntry {
  readonly zoneId: string;
  readonly test: (g: GeoPoint) => boolean;
}

export class SphereHitIndex {
  private readonly entries: readonly HitEntry[];

  constructor(doc: MapDocument) {
    const entries: HitEntry[] = [];
    for (const zone of doc.zones) {
      const geom = zone.geometry;
      if (geom === null) continue;
      if (geom.kind === 'sphericalPolygon') {
        if (geom.rings.length === 0 || geom.rings[0].length < 3) continue;
        const rings = geom.rings;
        entries.push({ zoneId: zone.id, test: (g) => pointInSphericalPolygon(g, rings) });
      } else if (geom.kind === 'sphericalCap' && geom.radiusDeg > 0) {
        const { center, radiusDeg } = geom;
        entries.push({ zoneId: zone.id, test: (g) => pointInSphericalCap(g, center, radiusDeg) });
      }
    }
    this.entries = entries;
  }

  hitTest(geo: GeoPoint | null): string | null {
    if (geo === null) return null;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].test(geo)) return this.entries[i].zoneId;
    }
    return null;
  }
}

/** Centroid of a selected grid cell not present in `items` (plain cells). */
function gridSelectionCentroid(render: SphereRender, zoneId: string): GeoPoint | null {
  if (render.grid === null) return null;
  const pos = render.gridPosById.get(zoneId);
  if (pos === undefined) return null;
  return cellCenter(render.grid, pos.col, pos.row);
}

/** Analytic grid pick (§14.4). Off-disc/limb taps arrive as `geo == null`. */
export function gridPick(render: SphereRender, geo: GeoPoint | null): string | null {
  if (geo === null || render.grid === null || render.gridZoneIdByCell === null) return null;
  const cell = gridCellAt(geo, render.grid);
  return render.gridZoneIdByCell[cell.row * render.grid.cols + cell.col];
}

// --- Painter (§14.6) --------------------------------------------------------

function css(c: MapColor): string {
  return colorAlpha(c, 1);
}

/** Project a ring to a Path2D with back-hemisphere limb clamping. */
function projectRingsPath(
  rings: readonly (readonly GeoPoint[])[],
  q: Quat,
  R: number,
  C: ScreenPoint,
): Path2D {
  const path = new Path2D();
  for (const ring of rings) {
    ring.forEach((g, i) => {
      const v = rotate(q, worldVec(g));
      let sx: number;
      let sy: number;
      if (v.z >= 0) {
        sx = C.x + R * v.x;
        sy = C.y - R * v.y;
      } else {
        const len = Math.hypot(v.x, v.y) || 1e-9;
        sx = C.x + v.x * (R / len);
        sy = C.y - v.y * (R / len);
      }
      if (i === 0) path.moveTo(sx, sy);
      else path.lineTo(sx, sy);
    });
    path.closePath();
  }
  return path;
}

function frontProject(g: GeoPoint, q: Quat, R: number, C: ScreenPoint): { x: number; y: number; front: boolean } {
  const v = rotate(q, worldVec(g));
  return { x: C.x + R * v.x, y: C.y - R * v.y, front: v.z >= 0 };
}

export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  opts: {
    render: SphereRender;
    width: number;
    height: number;
    orientation: Quat;
    zoom: number;
    selectedId: string | null;
    dimmed: ReadonlySet<string>;
    /** When a filter is active, hide the non-matching (dimmed) zones entirely. */
    hideDimmed?: boolean;
  },
): void {
  const { render, width, height, orientation: q, zoom, selectedId, dimmed } = opts;
  const hideDimmed = opts.hideDimmed ?? false;
  const theme = render.theme;
  const R = globeRadius(width, height, zoom);
  const C = globeCenter(width, height);
  // Thin zone outlines — the old width made small tiles look heavily bordered.
  const strokeW = Math.max(0.6, Math.min(2.2, R * 0.005));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = css(theme.background);
  ctx.fillRect(0, 0, width, height);

  // 1. Atmosphere.
  const ring = (radius: number, w: number, alpha: number, sigma: number): void => {
    const prev = ctx.filter;
    try {
      ctx.filter = `blur(${sigma}px)`;
    } catch {
      /* unsupported */
    }
    ctx.beginPath();
    ctx.arc(C.x, C.y, radius, 0, Math.PI * 2);
    ctx.lineWidth = w;
    ctx.strokeStyle = colorAlpha(theme.glow, alpha);
    ctx.stroke();
    ctx.filter = prev;
  };
  ring(1.035 * R, 0.075 * R, 0.16, 0.08 * R);
  ring(1.012 * R, 0.028 * R, 0.22, 0.035 * R);

  // 2. Disc (radial-shaded body, lit from upper-left).
  const body = lerpColor(theme.zoneFill, theme.surface, 0.35);
  const lit = lerpColor(body, theme.glow, 0.3);
  const dark = lerpColor(body, { r: 0, g: 0, b: 0, a: 1 }, 0.72);
  const gx = C.x - 0.42 * R;
  const gy = C.y - 0.46 * R;
  const discGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 1.3 * R);
  discGrad.addColorStop(0, css(lit));
  discGrad.addColorStop(0.48, css(body));
  discGrad.addColorStop(1, css(dark));
  ctx.beginPath();
  ctx.arc(C.x, C.y, R, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  // 3. Clip to the disc.
  ctx.save();
  ctx.beginPath();
  ctx.arc(C.x, C.y, R, 0, Math.PI * 2);
  ctx.clip();

  // 4. Graticule (grid docs).
  if (render.graticule !== null) {
    ctx.lineWidth = Math.max(0.6, Math.min(1.4, R * 0.0035));
    ctx.strokeStyle = colorAlpha(theme.zoneStroke, 0.14);
    const path = new Path2D();
    for (const line of render.graticule) {
      let penDown = false;
      for (const g of line) {
        const p = frontProject(g, q, R, C);
        if (!p.front) {
          penDown = false;
          continue;
        }
        if (!penDown) {
          path.moveTo(p.x, p.y);
          penDown = true;
        } else {
          path.lineTo(p.x, p.y);
        }
      }
    }
    ctx.stroke(path);
  }

  // 5. Zones (selected deferred).
  for (const item of render.items) {
    if (!item.hasBody || item.zoneId === selectedId) continue;
    const isDim = dimmed.has(item.zoneId);
    if (isDim && hideDimmed) continue; // filter active → only matching zones show
    const cen = rotate(q, worldVec(item.centroid));
    if (cen.z < 0) continue; // back-hemisphere cull
    const path = projectRingsPath(item.rings, q, R, C);
    if (isDim) ctx.globalAlpha = 0.3;
    paintPolygonZone(ctx, path, item.theme, strokeW, false);
    if (isDim) ctx.globalAlpha = 1;
  }

  // 6. Selected zone on top (never dimmed).
  if (selectedId !== null) {
    const selItem = render.items.find((it) => it.zoneId === selectedId);
    if (selItem !== undefined && selItem.hasBody) {
      paintPolygonZone(ctx, projectRingsPath(selItem.rings, q, R, C), selItem.theme, strokeW, true);
    } else if (render.grid !== null) {
      const pos = render.gridPosById.get(selectedId);
      if (pos !== undefined) {
        const ringPts = gridCellRing(render.grid, pos.col, pos.row);
        paintPolygonZone(ctx, projectRingsPath([ringPts], q, R, C), theme, strokeW, true);
      }
    }
  }

  // 7. Limb darkening.
  const limb = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R);
  limb.addColorStop(0, colorAlpha(theme.background, 0));
  limb.addColorStop(0.62, colorAlpha(theme.background, 0));
  limb.addColorStop(1, colorAlpha(theme.background, 0.55));
  ctx.beginPath();
  ctx.arc(C.x, C.y, R, 0, Math.PI * 2);
  ctx.fillStyle = limb;
  ctx.fill();
  ctx.restore();

  // 8. Rim.
  const strokeRing = (radius: number, w: number, style: string, sigma: number): void => {
    const prev = ctx.filter;
    if (sigma > 0) {
      try {
        ctx.filter = `blur(${sigma}px)`;
      } catch {
        /* unsupported */
      }
    }
    ctx.beginPath();
    ctx.arc(C.x, C.y, radius, 0, Math.PI * 2);
    ctx.lineWidth = w;
    ctx.strokeStyle = style;
    ctx.stroke();
    ctx.filter = prev;
  };
  strokeRing(R, 0.02 * R, colorAlpha(theme.glow, 0.55), 0.03 * R);
  strokeRing(R, 0.006 * R, colorAlpha(theme.glow, 0.35), 0);
  // Inner rim light arc.
  {
    const prev = ctx.filter;
    try {
      ctx.filter = `blur(${0.05 * R}px)`;
    } catch {
      /* unsupported */
    }
    ctx.beginPath();
    const start = -3 * Math.PI / 4 - 0.42 * Math.PI;
    ctx.arc(C.x, C.y, 0.965 * R, start, start + 0.84 * Math.PI);
    ctx.lineWidth = 0.035 * R;
    ctx.strokeStyle = colorAlpha(lerpColor(theme.glow, { r: 255, g: 255, b: 255, a: 1 }, 0.55), 0.18);
    ctx.stroke();
    ctx.filter = prev;
  }

  // 9. Label only the selected zone. Dumping every front-facing label turns a
  //    170-zone globe into an unreadable smear; the flat grid view is the
  //    dense, fully-labelled twin. Here the globe stays clean — tap a zone and
  //    its name floats over it (the detail sheet carries the rest).
  if (selectedId !== null && R >= LABEL_MIN_RADIUS) {
    const sel = render.items.find((it) => it.zoneId === selectedId);
    const label = sel?.label ?? null;
    const centroid = sel?.centroid ?? gridSelectionCentroid(render, selectedId);
    if (label !== null && centroid !== null) {
      const p = frontProject(centroid, q, R, C);
      if (p.front && Math.hypot(p.x - C.x, p.y - C.y) <= 0.98 * R) {
        drawCenteredLabel(ctx, label, p.x, p.y, sel?.theme ?? theme, render.labelFontSize);
      }
    }
  }
}
