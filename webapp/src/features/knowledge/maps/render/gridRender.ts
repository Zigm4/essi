/**
 * Grid table view — the "text map" twin of a grid-sphere globe (maps spec §15).
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
}

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

  // Cell fills.
  for (const cell of render.cells) {
    const dim = opts.dimmed.has(cell.zoneId);
    const baseAlpha = cell.explored ? 0.42 : 0.08;
    const alpha = dim ? baseAlpha * DIM_ALPHA : baseAlpha;
    const fill = cell.explored ? cell.theme.zoneFill : render.theme.zoneFill;
    ctx.fillStyle = colorAlpha(fill, alpha);
    ctx.fillRect(cell.rect.x, cell.rect.y, cell.rect.w, cell.rect.h);
  }

  // Grid lines.
  const lines = new Path2D();
  for (let c = 0; c <= render.cols; c++) {
    const x = c * GRID_CELL_WIDTH;
    lines.moveTo(x, 0);
    lines.lineTo(x, render.canvasHeight);
  }
  for (let r = 0; r <= render.rows; r++) {
    const y = r * GRID_CELL_HEIGHT;
    lines.moveTo(0, y);
    lines.lineTo(render.canvasWidth, y);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = colorAlpha(render.theme.zoneStroke, 0.18);
  ctx.stroke(lines);

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
