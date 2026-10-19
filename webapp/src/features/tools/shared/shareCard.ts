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

export interface PlanetGlyphSpec {
  light: string;
  dark: string;
  hasRing: boolean;
}

export type CardBlock =
  | { kind: 'divider'; alpha?: number }
  | { kind: 'space'; height: number }
  | { kind: 'hero'; emoji: string; title: string; caption?: string }
  | { kind: 'kv'; label: string; value: string; valueColor?: string; large?: boolean }
  | { kind: 'status'; emoji: string; text: string; color: string }
  | { kind: 'caption'; text: string; color?: string }
  /**
   * Wrapped body text (a job description). `lines` is filled in by
   * renderCardPng with the real font; until then the height is estimated.
   */
  | { kind: 'paragraph'; text: string; maxLines?: number; color?: string; lines?: readonly string[] }
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
  accent: string;
  accent2: string;
  text: string;
  text2: string;
  dim: string;
  border: string;
}

const FALLBACK: Palette = {
  bg: '#03060b',
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
  const words = text.split(/\s+/).filter((w) => w.length > 0);
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
      setFont(ctx, `22px ${SANS}`);
      ctx.fillStyle = p.text;
      ctx.fillText(block.emoji, left, y + 26);
      setFont(ctx, `600 16px ${SANS}`);
      ctx.fillText(fit(ctx, block.title, width - 34), left + 34, y + 20);
      if (block.caption !== undefined) {
        setFont(ctx, `11px ${MONO}`);
        ctx.fillStyle = p.text2;
        ctx.fillText(fit(ctx, block.caption, width - 34), left + 34, y + 37);
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
  // Wrap paragraphs with the real font first: their line count sets the height.
  setFont(ctx, `${PARAGRAPH_FONT_SIZE}px ${SANS}`);
  const spec: CardSpec = {
    ...input,
    blocks: input.blocks.map((b) =>
      b.kind === 'paragraph'
        ? { ...b, lines: wrapLines(ctx, b.text, CARD_WIDTH - PAD * 2, b.maxLines ?? PARAGRAPH_MAX_LINES) }
        : b,
    ),
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
