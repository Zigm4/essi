/**
 * Share-card renderer: draws a result card straight onto a canvas and returns
 * a PNG. Same look as the app (tokens.css colours, Inter / JetBrainsMono, the
 * native app's 380 px card at 3×) without a DOM-to-image dependency, so it
 * works offline and isn't tripped up by web fonts or blend effects.
 *
 * A card is a header (title, optional subtitle and pill), a list of blocks and
 * a footer. `measureCard` lays it out (pure, unit-tested); `renderCardPng`
 * draws it.
 */

import { withAlpha } from '../../../design-system/color';

export interface PlanetGlyphSpec {
  light: string;
  dark: string;
  hasRing: boolean;
}

export type CardBlock =
  | { kind: 'divider'; alpha?: number }
  | { kind: 'space'; height: number }
  /** `dot`: a filled circle on the right in that colour (a fishing zone's depth). */
  | { kind: 'hero'; emoji: string; title: string; caption?: string; dot?: string }
  | { kind: 'kv'; label: string; value: string; valueColor?: string; large?: boolean }
  | { kind: 'status'; emoji: string; text: string; color: string }
  | { kind: 'caption'; text: string; color?: string }
  /**
   * Wrapped body text (a job description). `lines` is filled in by
   * renderCardPng with the real font; until then the height is estimated.
   */
  | { kind: 'paragraph'; text: string; maxLines?: number; color?: string; lines?: readonly string[] }
  /**
   * A card like the app's GlassCard (the job sheet's panels). Its items are
   * laid out by renderCardPng (`layout`); until then the height is estimated.
   * `tint` (#RRGGBB) draws it like the app's alert boxes instead: a tinted
   * fill and border.
   */
  | { kind: 'panel'; items: readonly PanelItem[]; layout?: PanelLayout; tint?: string }
  | { kind: 'listRow'; emoji: string; text: string; trailing: string }
  | {
      kind: 'planet';
      name: string;
      glyph: PlanetGlyphSpec;
      line: string;
      lineColor: string;
      sector: number;
      sl: string;
    };

/** A fact-table row: dimmed mono label, coloured value (wraps to 2 lines). */
export interface FactRowSpec {
  label: string;
  value: string;
  color?: string;
}

export type PanelItem =
  /**
   * Job text with the app's inline markdown: **bold** (blue, heavy), `code`.
   * `color` sets the plain text's colour (a dimmer hint).
   */
  | { kind: 'rich'; text: string; maxLines?: number; color?: string }
  | { kind: 'facts'; rows: readonly FactRowSpec[] }
  /** "ON COMPLETE"-style small caps heading. */
  | { kind: 'heading'; text: string; color?: string };

export type RunStyle = 'plain' | 'bold' | 'code';
export interface Run {
  text: string;
  style: RunStyle;
}

type LaidItem =
  | { kind: 'rich'; lines: Run[][]; color?: string }
  | { kind: 'facts'; rows: { label: string; lines: string[]; color?: string }[] }
  | { kind: 'heading'; text: string; color?: string };

export interface PanelLayout {
  items: LaidItem[];
}

export interface CardSpec {
  title: string;
  subtitle?: string;
  pill?: string;
  blocks: CardBlock[];
  footer: string;
}

export const CARD_WIDTH = 380;
export const CARD_SCALE = 3;
const PAD = 16;
const HERO_DOT_RADIUS = 14;

/** Height (in card px) taken by each block. */
export function blockHeight(block: CardBlock): number {
  switch (block.kind) {
    case 'divider':
      return 1;
    case 'space':
      return block.height;
    case 'hero':
      return block.caption === undefined ? 34 : 46;
    case 'kv':
      return block.large === true ? 34 : 24;
    case 'status':
      return 32;
    case 'caption':
      return 20;
    case 'paragraph':
      return PARAGRAPH_PAD + PARAGRAPH_LINE * (block.lines?.length ?? estimateLines(block));
    case 'panel':
      return panelHeight(block) + PANEL_GAP;
    case 'listRow':
      return 22;
    case 'planet':
      return 46;
  }
}

const PARAGRAPH_LINE = 17;
const PARAGRAPH_PAD = 8;
const PARAGRAPH_MAX_LINES = 6;
const PARAGRAPH_FONT_SIZE = 13;

/** Rough line count before layout (~52 characters per line at 13 px). */
function estimateLines(block: { text: string; maxLines?: number }): number {
  return Math.max(1, Math.min(block.maxLines ?? PARAGRAPH_MAX_LINES, Math.ceil(block.text.length / 52)));
}

// Panels mirror the app's GlassCard (12 px padding, 14 px corners) and the
// job sheet's text sizes, scaled to the 380 px card.
const PANEL_PAD = 12;
const PANEL_GAP = 10;
const PANEL_ITEM_GAP = 6;
const RICH_LINE = 18;
const FACT_LINE = 17;
const FACT_ROW_PAD = 6;
const FACT_KEY_WIDTH = 134;
const HEADING_HEIGHT = 18;
const PANEL_INNER = CARD_WIDTH - PAD * 2 - PANEL_PAD * 2;

function itemHeight(item: LaidItem): number {
  switch (item.kind) {
    case 'rich':
      return item.lines.length * RICH_LINE;
    case 'facts':
      return item.rows.reduce((h, r) => h + Math.max(1, r.lines.length) * FACT_LINE + FACT_ROW_PAD, 0);
    case 'heading':
      return HEADING_HEIGHT;
  }
}

/** Rough layout before measuring (~48 characters per text line). */
function estimateLayout(items: readonly PanelItem[]): PanelLayout {
  return {
    items: items.map((item): LaidItem => {
      switch (item.kind) {
        case 'rich': {
          const n = Math.max(1, Math.min(item.maxLines ?? 10, Math.ceil(item.text.length / 48)));
          return { kind: 'rich', lines: Array.from({ length: n }, () => []), color: item.color };
        }
        case 'facts':
          return { kind: 'facts', rows: item.rows.map((r) => ({ label: r.label, lines: [r.value], color: r.color })) };
        case 'heading':
          return item;
      }
    }),
  };
}

function panelHeight(block: { items: readonly PanelItem[]; layout?: PanelLayout }): number {
  const items = (block.layout ?? estimateLayout(block.items)).items;
  const body = items.reduce((h, item) => h + itemHeight(item), 0);
  return PANEL_PAD * 2 + body + Math.max(0, items.length - 1) * PANEL_ITEM_GAP;
}

/**
 * The app's inline markdown (shared/markdown.tsx): `**bold**`, ``` ``code`` ```
 * and `` `code` ``. One array of runs per paragraph (newline-separated).
 */
export function parseInlineMarkdown(text: string): Run[][] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const runs: Run[] = [];
      let i = 0;
      let plainStart = 0;
      const flush = (end: number) => {
        if (end > plainStart) runs.push({ text: p.slice(plainStart, end), style: 'plain' });
      };
      while (i < p.length) {
        const marker = p.startsWith('**', i) ? '**' : p.startsWith('``', i) ? '``' : p[i] === '`' ? '`' : null;
        const close = marker === null ? -1 : p.indexOf(marker, i + marker.length);
        if (marker !== null && close !== -1) {
          flush(i);
          const inner = p.slice(i + marker.length, close);
          runs.push({ text: marker === '**' ? inner : inner.trim(), style: marker === '**' ? 'bold' : 'code' });
          i = close + marker.length;
          plainStart = i;
          continue;
        }
        i++;
      }
      flush(p.length);
      return runs;
    });
}

type MeasureRun = (text: string, style: RunStyle) => number;

/** Words as units of styled pieces ("**PRQ**:" stays one unit), with the spacing before them. */
function wordUnits(runs: readonly Run[]): { pieces: Run[]; spaced: boolean }[] {
  const units: { pieces: Run[]; spaced: boolean }[] = [];
  let current: Run[] = [];
  let spaced = false;
  const close = () => {
    if (current.length > 0) units.push({ pieces: current, spaced });
    current = [];
  };
  for (const run of runs) {
    // Plain spaces only, like wrapLines: a no-break space keeps its words together.
    for (const part of run.text.split(/([ \t\r\n]+)/)) {
      if (part.length === 0) continue;
      if (/^[ \t\r\n]+$/.test(part)) {
        close();
        spaced = units.length > 0;
        continue;
      }
      current.push({ text: part, style: run.style });
    }
  }
  close();
  return units;
}

function appendRun(line: Run[], run: Run): void {
  const last = line[line.length - 1];
  if (last !== undefined && last.style === run.style) last.text += run.text;
  else line.push({ ...run });
}

/**
 * Word-wraps styled paragraphs into lines of `width`, at most `maxLines`; text
 * left over ends the last line with "…".
 */
export function wrapRich(
  paragraphs: readonly Run[][],
  width: number,
  maxLines: number,
  measure: MeasureRun,
): Run[][] {
  const lines: Run[][] = [];
  let truncated = false;
  for (const paragraph of paragraphs) {
    let line: Run[] = [];
    let lineWidth = 0;
    for (const unit of wordUnits(paragraph)) {
      const unitWidth = unit.pieces.reduce((w, p) => w + measure(p.text, p.style), 0);
      const space = line.length > 0 && unit.spaced ? measure(' ', 'plain') : 0;
      if (line.length > 0 && lineWidth + space + unitWidth > width) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      if (line.length > 0 && unit.spaced) {
        appendRun(line, { text: ' ', style: 'plain' });
        lineWidth += measure(' ', 'plain');
      }
      for (const piece of unit.pieces) appendRun(line, piece);
      lineWidth += unitWidth;
    }
    if (line.length > 0) lines.push(line);
    if (lines.length > maxLines) {
      truncated = true;
      break;
    }
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  if (truncated && lines.length > 0) {
    const last = lines[lines.length - 1]!;
    const widthOf = (l: Run[]) => l.reduce((w, r) => w + measure(r.text, r.style), 0);
    while (widthOf(last) + measure('…', 'plain') > width && last.length > 0) {
      const tail = last[last.length - 1]!;
      tail.text = tail.text.slice(0, -1).trimEnd();
      if (tail.text.length === 0) last.pop();
    }
    appendRun(last, { text: '…', style: 'plain' });
  }
  return lines;
}

const HEADER_HEIGHT = 34; // title + subtitle
const HEADER_HEIGHT_NO_SUBTITLE = 16;
const FOOTER_HEIGHT = 24; // gap + footer line

/** Total card height in card px (before the 3× scale). */
export function measureCard(spec: CardSpec): number {
  const header = spec.subtitle === undefined ? HEADER_HEIGHT_NO_SUBTITLE : HEADER_HEIGHT;
  const body = spec.blocks.reduce((sum, b) => sum + blockHeight(b), 0);
  return Math.ceil(PAD + header + 12 + body + FOOTER_HEIGHT + PAD);
}

interface Palette {
  bg: string;
  /** GlassCard fill (--bg-card). */
  card: string;
  accent: string;
  accent2: string;
  text: string;
  text2: string;
  dim: string;
  border: string;
}

const FALLBACK: Palette = {
  bg: '#03060b',
  card: '#111e30',
  accent: '#4fc3ff',
  accent2: '#7ae3ff',
  text: '#e8f4ff',
  text2: '#8aa4c2',
  dim: '#6e8aab',
  border: 'rgba(122, 227, 255, 0.12)',
};

function palette(): Palette {
  if (typeof document === 'undefined') return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: read('--bg-deepest', FALLBACK.bg),
    card: read('--bg-card', FALLBACK.card),
    accent: read('--accent-primary', FALLBACK.accent),
    accent2: read('--accent-secondary', FALLBACK.accent2),
    text: read('--text-primary', FALLBACK.text),
    text2: read('--text-secondary', FALLBACK.text2),
    dim: read('--text-dim', FALLBACK.dim),
    border: read('--border-subtle', FALLBACK.border),
  };
}

const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrainsMono', ui-monospace, monospace";

async function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts === undefined) return;
  await Promise.all([
    document.fonts.load(`700 11px ${MONO}`),
    document.fonts.load(`600 14px ${MONO}`),
    document.fonts.load(`600 16px ${SANS}`),
    document.fonts.load(`400 13px ${SANS}`),
    document.fonts.load(`800 13px ${SANS}`),
    document.fonts.load(`12px ${MONO}`),
  ]).catch(() => undefined);
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function setFont(ctx: Ctx, font: string, spacing = '0px'): void {
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing;
}

/** `text` cut with an ellipsis so it fits `maxWidth`. */
function fit(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Greedy word wrap into at most `maxLines` lines of `maxWidth`; when text is
 * left over, the last line ends with "…" (nothing is dropped silently).
 */
export function wrapLines(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  // Plain spaces only: a no-break space (U+00A0) keeps its words together.
  const words = text.split(/[ \t\r\n]+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  for (; i < words.length; i++) {
    const candidate = current.length === 0 ? words[i]! : `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[i]!;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
    current = '';
    i = words.length;
  }
  const leftover = i < words.length;
  const last = lines.length - 1;
  if (last >= 0 && (leftover || ctx.measureText(lines[last]!).width > maxWidth)) {
    let cut = lines[last]!;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    lines[last] = `${cut.trimEnd()}…`;
  }
  return lines;
}

function drawPlanet(ctx: Ctx, cx: number, cy: number, glyph: PlanetGlyphSpec): void {
  const r = 11;
  const gradient = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  gradient.addColorStop(0, glyph.light);
  gradient.addColorStop(1, glyph.dark);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (glyph.hasRing) {
    ctx.strokeStyle = glyph.light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.6, r * 0.45, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function divider(ctx: Ctx, y: number, p: Palette, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.border;
  ctx.fillRect(PAD, y, CARD_WIDTH - PAD * 2, 1);
  ctx.restore();
}

function drawBlock(ctx: Ctx, block: CardBlock, y: number, p: Palette): void {
  const left = PAD;
  const right = CARD_WIDTH - PAD;
  const width = right - left;
  ctx.textBaseline = 'alphabetic';
  switch (block.kind) {
    case 'divider':
      divider(ctx, y, p, block.alpha ?? 0.5);
      return;
    case 'space':
      return;
    case 'hero': {
      // The app's 56 px depth circle, at the card's scale.
      const dotSpace = block.dot === undefined ? 0 : HERO_DOT_RADIUS * 2 + 10;
      if (block.dot !== undefined) {
        ctx.fillStyle = withAlpha(block.dot, 0.55);
        ctx.beginPath();
        ctx.arc(right - HERO_DOT_RADIUS, y + blockHeight(block) / 2, HERO_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      setFont(ctx, `22px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(block.emoji, left, y + 26);
      setFont(ctx, `600 16px ${SANS}`);
      ctx.fillText(fit(ctx, block.title, width - 34 - dotSpace), left + 34, y + 20);
      if (block.caption !== undefined) {
        setFont(ctx, `11px ${MONO}`);
        ctx.fillStyle = p.text2;
        ctx.fillText(fit(ctx, block.caption, width - 34 - dotSpace), left + 34, y + 37);
      }
      return;
    }
    case 'kv': {
      setFont(ctx, `13px ${SANS}`);
      ctx.fillStyle = p.text2;
      ctx.fillText(block.label, left, y + (block.large === true ? 23 : 16));
      // The value takes whatever the label leaves (a place name needs the room).
      const valueWidth = width - ctx.measureText(block.label).width - 14;
      setFont(ctx, `600 ${block.large === true ? 22 : 13}px ${MONO}`);
      ctx.fillStyle = block.valueColor ?? p.text;
      ctx.textAlign = 'right';
      ctx.fillText(fit(ctx, block.value, valueWidth), right, y + (block.large === true ? 25 : 16));
      ctx.textAlign = 'left';
      return;
    }
    case 'status': {
      setFont(ctx, `20px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(block.emoji, left, y + 23);
      setFont(ctx, `600 13px ${SANS}`);
      ctx.fillStyle = block.color;
      ctx.fillText(fit(ctx, block.text, width - 32), left + 32, y + 21);
      return;
    }
    case 'caption': {
      setFont(ctx, `12px ${SANS}`);
      ctx.fillStyle = block.color ?? p.dim;
      ctx.fillText(fit(ctx, block.text, width), left, y + 14);
      return;
    }
    case 'paragraph': {
      setFont(ctx, `${PARAGRAPH_FONT_SIZE}px ${SANS}`);
      ctx.fillStyle = block.color ?? p.text;
      (block.lines ?? [block.text]).forEach((line, i) => {
        ctx.fillText(line, left, y + 13 + i * PARAGRAPH_LINE);
      });
      return;
    }
    case 'panel': {
      drawPanel(ctx, block.layout ?? estimateLayout(block.items), y, panelHeight(block), p, block.tint);
      return;
    }
    case 'listRow': {
      setFont(ctx, `14px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(block.emoji, left, y + 16);
      setFont(ctx, `11px ${MONO}`);
      const trailingWidth = ctx.measureText(block.trailing).width;
      ctx.fillStyle = p.text2;
      ctx.textAlign = 'right';
      ctx.fillText(block.trailing, right, y + 15);
      ctx.textAlign = 'left';
      setFont(ctx, `13px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(fit(ctx, block.text, width - 24 - trailingWidth - 10), left + 24, y + 15);
      return;
    }
    case 'planet': {
      drawPlanet(ctx, left + 14, y + 23, block.glyph);
      setFont(ctx, `600 14px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(block.name, left + 38, y + 20);
      setFont(ctx, `11px ${MONO}`);
      ctx.fillStyle = block.lineColor;
      ctx.fillText(fit(ctx, block.line, width - 38 - 90), left + 38, y + 36);
      ctx.textAlign = 'right';
      const sector = String(block.sector);
      setFont(ctx, `700 18px ${MONO}`);
      const sectorWidth = ctx.measureText(sector).width;
      ctx.fillStyle = p.accent;
      ctx.fillText(sector, right, y + 22);
      setFont(ctx, `10px ${MONO}`, '1px');
      ctx.fillStyle = p.text2;
      ctx.fillText('SECTOR', right - sectorWidth - 6, y + 21);
      setFont(ctx, `600 11px ${MONO}`);
      ctx.fillStyle = p.accent2;
      ctx.fillText(block.sl, right, y + 37);
      ctx.textAlign = 'left';
      return;
    }
  }
}

const RICH_FONT: Record<RunStyle, string> = {
  plain: `13px ${SANS}`,
  bold: `800 13px ${SANS}`,
  code: `12px ${MONO}`,
};

function runMeasurer(ctx: Ctx): MeasureRun {
  return (text, style) => {
    setFont(ctx, RICH_FONT[style]);
    return ctx.measureText(text).width;
  };
}

function drawPanel(ctx: Ctx, layout: PanelLayout, y: number, height: number, p: Palette, tint?: string): void {
  const x = PAD;
  const w = CARD_WIDTH - PAD * 2;
  // A tinted panel is an alert box (tint@12% fill, tint@50% border, 8 px corners).
  ctx.fillStyle = tint === undefined ? p.card : withAlpha(tint, 0.12);
  ctx.beginPath();
  ctx.roundRect(x, y, w, height, tint === undefined ? 14 : 8);
  ctx.fill();
  ctx.strokeStyle = tint === undefined ? p.border : withAlpha(tint, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  const left = x + PANEL_PAD;
  const measure = runMeasurer(ctx);
  let cy = y + PANEL_PAD;
  layout.items.forEach((item, index) => {
    if (index > 0) cy += PANEL_ITEM_GAP;
    switch (item.kind) {
      case 'heading':
        setFont(ctx, `700 11px ${MONO}`, '1.5px');
        ctx.fillStyle = item.color ?? p.accent;
        ctx.fillText(item.text, left, cy + 12);
        break;
      case 'rich':
        item.lines.forEach((line, i) => {
          let lx = left;
          const baseline = cy + 13 + i * RICH_LINE;
          for (const run of line) {
            const runWidth = measure(run.text, run.style);
            if (run.style === 'code') {
              ctx.fillStyle = p.bg;
              ctx.beginPath();
              ctx.roundRect(lx - 1, baseline - 11, runWidth + 2, 15, 3);
              ctx.fill();
            }
            setFont(ctx, RICH_FONT[run.style]);
            ctx.fillStyle = run.style === 'bold' ? p.accent : run.style === 'code' ? p.accent2 : (item.color ?? p.text);
            ctx.fillText(run.text, lx, baseline);
            lx += runWidth;
          }
        });
        break;
      case 'facts': {
        let ry = cy;
        for (const row of item.rows) {
          setFont(ctx, `11px ${MONO}`);
          ctx.fillStyle = p.dim;
          ctx.fillText(fit(ctx, row.label, FACT_KEY_WIDTH - 8), left, ry + 13);
          setFont(ctx, `13px ${SANS}`);
          ctx.fillStyle = row.color ?? p.text;
          row.lines.forEach((l, i) => ctx.fillText(l, left + FACT_KEY_WIDTH, ry + 13 + i * FACT_LINE));
          ry += Math.max(1, row.lines.length) * FACT_LINE + FACT_ROW_PAD;
        }
        break;
      }
    }
    cy += itemHeight(item);
  });
}

export function keepParenthesesTogether(text: string): string {
  return text.replace(/\([^)]*\)/g, (m) => m.replace(/ /g, '\u00A0'));
}

/** Lays out a panel's text with the real fonts (line breaks set its height). */
function layoutPanel(ctx: Ctx, items: readonly PanelItem[]): PanelLayout {
  const measure = runMeasurer(ctx);
  return {
    items: items.map((item): LaidItem => {
      switch (item.kind) {
        case 'heading':
          return item;
        case 'rich':
          return {
            kind: 'rich',
            lines: wrapRich(parseInlineMarkdown(item.text), PANEL_INNER, item.maxLines ?? 10, measure),
            color: item.color,
          };
        case 'facts':
          setFont(ctx, `13px ${SANS}`);
          return {
            kind: 'facts',
            rows: item.rows.map((r) => ({
              label: r.label,
              color: r.color,
              // "(355 · z35)" never splits: a long place breaks before its coordinates.
              lines: wrapLines(ctx, keepParenthesesTogether(r.value), PANEL_INNER - FACT_KEY_WIDTH, 2),
            })),
          };
      }
    }),
  };
}

/**
 * Draws the card and returns it as a PNG blob.
 * @throws when the browser has no 2D canvas.
 */
export async function renderCardPng(input: CardSpec): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * CARD_SCALE;
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (ctx === null) throw new Error('No 2D canvas');
  // Lay text out with the real fonts first: line counts set the height.
  const spec: CardSpec = {
    ...input,
    blocks: input.blocks.map((b) => {
      if (b.kind === 'paragraph') {
        setFont(ctx, `${PARAGRAPH_FONT_SIZE}px ${SANS}`);
        return { ...b, lines: wrapLines(ctx, b.text, CARD_WIDTH - PAD * 2, b.maxLines ?? PARAGRAPH_MAX_LINES) };
      }
      if (b.kind === 'panel') return { ...b, layout: layoutPanel(ctx, b.items) };
      return b;
    }),
  };
  const height = measureCard(spec);
  canvas.height = height * CARD_SCALE; // also resets the context state
  ctx.scale(CARD_SCALE, CARD_SCALE);
  const p = palette();

  // Background: deep space with the cards' top-left glow and a hairline frame.
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  const glow = ctx.createLinearGradient(0, 0, CARD_WIDTH, height);
  glow.addColorStop(0, 'rgba(79, 195, 255, 0.10)');
  glow.addColorStop(1, 'rgba(79, 195, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, CARD_WIDTH - 1, height - 1);

  // Header.
  let y = PAD;
  setFont(ctx, `700 11px ${MONO}`, '2px');
  ctx.fillStyle = p.accent;
  ctx.fillText(spec.title.toUpperCase(), PAD, y + 11);
  if (spec.pill !== undefined) {
    setFont(ctx, `700 10px ${MONO}`, '1.5px');
    const pillWidth = ctx.measureText(spec.pill).width + 12;
    const x = CARD_WIDTH - PAD - pillWidth;
    ctx.strokeStyle = 'rgba(79, 195, 255, 0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(x, y, pillWidth, 16, 3);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.fillText(spec.pill, x + 6, y + 12);
  }
  if (spec.subtitle !== undefined) {
    setFont(ctx, `12px ${MONO}`);
    ctx.fillStyle = p.text2;
    ctx.fillText(fit(ctx, spec.subtitle, CARD_WIDTH - PAD * 2), PAD, y + 30);
    y += HEADER_HEIGHT;
  } else {
    y += HEADER_HEIGHT_NO_SUBTITLE;
  }
  y += 6;
  divider(ctx, y, p, 0.5);
  y += 6;

  for (const block of spec.blocks) {
    drawBlock(ctx, block, y, p);
    y += blockHeight(block);
  }

  // Footer.
  y += 12;
  setFont(ctx, `9px ${MONO}`, '0.5px');
  ctx.fillStyle = p.dim;
  ctx.fillText(fit(ctx, spec.footer, CARD_WIDTH - PAD * 2), PAD, y + 9);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('PNG encoding failed')) : resolve(blob)), 'image/png');
  });
}
