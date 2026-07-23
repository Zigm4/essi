/**
 * Grid table view - the "text map" twin of a grid-sphere globe (maps spec §15).
 * A synthetic canvas of `cols×96 × rows×64` px with layered painters, sharing
 * the selection provider with the globe.
 */

import { sanitizeTheme, zoneTheme, colorAlpha, type MapTheme } from '../model/theme';
import type { MapDocument } from '../model/types';
import { paintLabelScrim, paintPolygonZone } from './paintOps';

export const GRID_CELL_WIDTH = 96;
export const GRID_CELL_HEIGHT = 64;
const NAME_FONT_SIZE = 13;
const NUM_FONT_SIZE = 10;
export const GRID_NAME_LOD_SCALE = 12 / NAME_FONT_SIZE;
const DIM_ALPHA = 0.3;
const PLACEHOLDER = /^Zone\s+\d+$/;

export interface GridCell {
  readonly zoneId: string;
  readonly col: number;
  readonly row: number;
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly theme: MapTheme;
  readonly explored: boolean;
  readonly cellNum: string | null;
  readonly name: string | null;
  /** Owned by a player (has an `owner` field) - drawn with a bolder border. */
  readonly owned: boolean;
  /** Cell numbers this railway cell links to (`railwayLinks`) - dashed segments. */
  readonly railwayLinks: readonly number[];
  /** POI overlay drawn on top of the cell (from the `role` field). */
  readonly marker: 'medical' | 'rustwind' | null;
}

/** Light steel colour for the railway dashes (shared with the globe painter). */
export const RAIL_COLOR = { r: 210, g: 228, b: 248, a: 1 };
const MEDICAL_RED = '#FF4A4A';

export interface GridRender {
  readonly theme: MapTheme;
  readonly cols: number;
  readonly rows: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly nameLodScale: number;
  readonly cells: readonly GridCell[];
  readonly zoneIdByCell: (string | null)[];
}

export function buildGridRender(doc: MapDocument): GridRender | null {
  const grid = doc.grid;
  if (grid === null) return null;
  const theme = sanitizeTheme(doc.theme);
  const cells: GridCell[] = [];
  const zoneIdByCell: (string | null)[] = new Array(grid.cols * grid.rows).fill(null);
  for (const zone of doc.zones) {
    const pos = zone.gridPos;
    if (pos === null || pos.col >= grid.cols || pos.row >= grid.rows) continue;
    const name = zone.name.trim();
    const role = typeof zone.fields.role === 'string' ? zone.fields.role : '';
    cells.push({
      zoneId: zone.id,
      col: pos.col,
      row: pos.row,
      rect: {
        x: pos.col * GRID_CELL_WIDTH,
        y: pos.row * GRID_CELL_HEIGHT,
        w: GRID_CELL_WIDTH,
        h: GRID_CELL_HEIGHT,
      },
      theme: zoneTheme(theme, zone.themeOverride),
      explored: zone.themeOverride !== null,
      cellNum: zone.cellNum !== null ? String(zone.cellNum) : null,
      name: name.length > 0 && !PLACEHOLDER.test(name) ? name : null,
      owned: typeof zone.fields.owner === 'string' && zone.fields.owner.length > 0,
      railwayLinks: Array.isArray(zone.fields.railwayLinks)
        ? zone.fields.railwayLinks.filter((n): n is number => typeof n === 'number')
        : [],
      marker: role === 'Medical Facility' ? 'medical' : role === 'Rustwind Gen' ? 'rustwind' : null,
    });
    zoneIdByCell[pos.row * grid.cols + pos.col] = zone.id;
  }
  return {
    theme,
    cols: grid.cols,
    rows: grid.rows,
    canvasWidth: grid.cols * GRID_CELL_WIDTH,
    canvasHeight: grid.rows * GRID_CELL_HEIGHT,
    nameLodScale: GRID_NAME_LOD_SCALE,
    cells,
    zoneIdByCell,
  };
}

function rectPath(r: { x: number; y: number; w: number; h: number }): Path2D {
  const path = new Path2D();
  path.rect(r.x, r.y, r.w, r.h);
  return path;
}

function drawName(ctx: CanvasRenderingContext2D, cell: GridCell): void {
  if (cell.name === null) return;
  const cx = cell.rect.x + cell.rect.w / 2;
  const cy = cell.rect.y + cell.rect.h / 2 + NUM_FONT_SIZE * 0.35;
  ctx.font = `600 ${NAME_FONT_SIZE}px "${cell.theme.fontFamily}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = GRID_CELL_WIDTH - 12;
  // Wrap to <= 2 lines.
  const words = cell.name.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur.length === 0 ? w : `${cur} ${w}`;
    if (ctx.measureText(cand).width <= maxWidth || cur.length === 0) cur = cand;
    else {
      lines.push(cur);
      cur = w;
      if (lines.length === 1) break;
    }
  }
  if (lines.length < 2) lines.push(cur);
  let last = lines[lines.length - 1];
  if (ctx.measureText(last).width > maxWidth) {
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  const clipped = lines.slice(0, 2);
  const lineH = NAME_FONT_SIZE * 1.05;
  const blockH = clipped.length * lineH;
  let blockW = 0;
  for (const l of clipped) blockW = Math.max(blockW, ctx.measureText(l).width);
  const padX = NAME_FONT_SIZE * 0.35;
  const padY = NAME_FONT_SIZE * 0.2;
  paintLabelScrim(
    ctx,
    cell.theme,
    cx - blockW / 2 - padX,
    cy - blockH / 2 - padY,
    blockW + padX * 2,
    blockH + padY * 2,
    NAME_FONT_SIZE * 0.4,
  );
  ctx.fillStyle = colorAlpha(cell.theme.label, 1);
  const startY = cy - blockH / 2 + lineH / 2;
  clipped.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH));
}

/** Table layer: fills, grid lines, cell numbers and (LOD-gated) names. */
export function drawGridTable(
  ctx: CanvasRenderingContext2D,
  render: GridRender,
  opts: { scale: number; dimmed: ReadonlySet<string> },
): void {
  ctx.clearRect(0, 0, render.canvasWidth, render.canvasHeight);

  // Faint base grid so empty (uncharted) cells still read as a lattice.
  const baseGrid = new Path2D();
  for (let c = 0; c <= render.cols; c++) {
    const x = c * GRID_CELL_WIDTH;
    baseGrid.moveTo(x, 0);
    baseGrid.lineTo(x, render.canvasHeight);
  }
  for (let r = 0; r <= render.rows; r++) {
    const y = r * GRID_CELL_HEIGHT;
    baseGrid.moveTo(0, y);
    baseGrid.lineTo(render.canvasWidth, y);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = colorAlpha(render.theme.zoneStroke, 0.1);
  ctx.stroke(baseGrid);

  // Cell fills as inset, rounded "tiles" so charted zones read as distinct
  // chips instead of one continuous wash - richer alpha, a top-light sheen and
  // a colored hairline border give the grid depth.
  const INSET = 2;
  const RADIUS = 4;
  for (const cell of render.cells) {
    if (!cell.explored) continue; // uncharted cells stay as bare lattice
    const dim = opts.dimmed.has(cell.zoneId);
    const alpha = dim ? 0.62 * DIM_ALPHA : 0.62;
    const x = cell.rect.x + INSET;
    const y = cell.rect.y + INSET;
    const w = cell.rect.w - INSET * 2;
    const h = cell.rect.h - INSET * 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, RADIUS);
    ctx.fillStyle = colorAlpha(cell.theme.zoneFill, alpha);
    ctx.fill();
    // Top-light sheen for a subtle 3D chip feel.
    const sheen = ctx.createLinearGradient(x, y, x, y + h);
    sheen.addColorStop(0, colorAlpha({ r: 255, g: 255, b: 255, a: 1 }, dim ? 0.04 : 0.1));
    sheen.addColorStop(0.5, colorAlpha({ r: 255, g: 255, b: 255, a: 1 }, 0));
    ctx.fillStyle = sheen;
    ctx.fill();
    if (cell.owned) {
      // Owner outline: bolder + fuller alpha so ownership reads at a glance.
      ctx.lineWidth = 3;
      ctx.strokeStyle = colorAlpha(cell.theme.zoneStroke, dim ? 0.4 : 1);
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colorAlpha(cell.theme.zoneStroke, dim ? 0.25 : 0.6);
    }
    ctx.stroke();
  }

  drawRailway(ctx, render, opts.dimmed);

  // Texts. Dimmed cells drawn through one shared 30% layer.
  const showNames = opts.scale >= render.nameLodScale;
  const drawCellText = (cell: GridCell): void => {
    if (cell.cellNum !== null) {
      ctx.font = `600 ${NUM_FONT_SIZE}px "${cell.theme.fontFamily}", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = colorAlpha(cell.theme.label, 0.55);
      ctx.fillText(cell.cellNum, cell.rect.x + 4, cell.rect.y + 3);
    }
    if (showNames) drawName(ctx, cell);
  };
  for (const cell of render.cells) {
    if (!opts.dimmed.has(cell.zoneId)) drawCellText(cell);
  }
  const anyDim = render.cells.some((c) => opts.dimmed.has(c.zoneId));
  if (anyDim) {
    ctx.globalAlpha = DIM_ALPHA;
    for (const cell of render.cells) {
      if (opts.dimmed.has(cell.zoneId)) drawCellText(cell);
    }
    ctx.globalAlpha = 1;
  }

  // POI markers on top of everything: medical cross / rustwind turbine.
  for (const cell of render.cells) {
    if (cell.marker === null) continue;
    const cx = cell.rect.x + cell.rect.w / 2;
    const cy = cell.rect.y + cell.rect.h / 2;
    ctx.save();
    ctx.globalAlpha = opts.dimmed.has(cell.zoneId) ? DIM_ALPHA : 1;
    if (cell.marker === 'medical') drawMedicalMarker(ctx, cx, cy, 11);
    else drawTurbineMarker(ctx, cx, cy, 24, cell.theme.fontFamily);
    ctx.restore();
  }
}

function cellCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * GRID_CELL_WIDTH + GRID_CELL_WIDTH / 2,
    y: row * GRID_CELL_HEIGHT + GRID_CELL_HEIGHT / 2,
  };
}

/** Thread a dashed line through the cells the Martian Railway crosses. */
function drawRailway(
  ctx: CanvasRenderingContext2D,
  render: GridRender,
  dimmed: ReadonlySet<string>,
): void {
  const byNum = new Map<number, GridCell>();
  for (const c of render.cells) {
    const n = c.cellNum === null ? NaN : Number.parseInt(c.cellNum, 10);
    if (Number.isInteger(n)) byNum.set(n, c);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 7]);
  for (const cell of render.cells) {
    if (cell.railwayLinks.length === 0) continue;
    const from = cell.cellNum === null ? NaN : Number.parseInt(cell.cellNum, 10);
    const a = cellCenter(cell.col, cell.row);
    ctx.strokeStyle = colorAlpha(RAIL_COLOR, dimmed.has(cell.zoneId) ? 0.3 : 0.95);
    for (const to of cell.railwayLinks) {
      if (from > to) continue; // draw each undirected edge once
      const other = byNum.get(to);
      if (other === undefined) continue;
      const b = cellCenter(other.col, other.row);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Red medical cross with a dark halo, sized by `arm` (arm length in px). Shared
 * by the grid and globe painters.
 */
export function drawMedicalMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  arm: number,
): void {
  const th = Math.max(2, arm * 0.46);
  const r = Math.max(1, arm * 0.18);
  const bar = (a: number, t: number): void => {
    ctx.beginPath();
    ctx.roundRect(cx - a, cy - t / 2, a * 2, t, r);
    ctx.roundRect(cx - t / 2, cy - a, t, a * 2, r);
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  bar(arm + 1.5, th + 3);
  ctx.fillStyle = MEDICAL_RED;
  bar(arm, th);
}

/**
 * Wind-turbine emoji at `fontPx`, with a dark shadow so the (light) glyph stays
 * legible on any background. Unicode has no dedicated turbine glyph. Shared by
 * the grid and globe painters.
 */
export function drawTurbineMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fontPx: number,
  fontFamily: string,
): void {
  ctx.save();
  ctx.font = `${fontPx}px "${fontFamily}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = Math.max(2, fontPx * 0.16);
  ctx.fillText('🌬️', cx, cy);
  ctx.restore();
}

/** Selection layer: the selected cell in the shared neon system. */
export function drawGridSelection(
  ctx: CanvasRenderingContext2D,
  render: GridRender,
  selectedId: string | null,
): void {
  ctx.clearRect(0, 0, render.canvasWidth, render.canvasHeight);
  if (selectedId === null) return;
  const cell = render.cells.find((c) => c.zoneId === selectedId);
  if (cell === undefined) return;
  paintPolygonZone(ctx, rectPath(cell.rect), cell.theme, 2.5, true);
}

export function gridHitTest(render: GridRender, point: { x: number; y: number }): string | null {
  const col = Math.max(0, Math.min(render.cols - 1, Math.floor(point.x / GRID_CELL_WIDTH)));
  const row = Math.max(0, Math.min(render.rows - 1, Math.floor(point.y / GRID_CELL_HEIGHT)));
  return render.zoneIdByCell[row * render.cols + col];
}
