/**
 * Map theme parsing + WCAG sanitization (maps spec §7). Colours are parsed
 * per-token tolerantly (bad token → its default); the resolved theme is then
 * run through `sanitizeTheme` which enforces the dark-guard, font whitelist,
 * stroke/label contrast and selection-visibility guards. `sanitize` is
 * idempotent.
 */

export interface MapColor {
  readonly r: number; // 0..255
  readonly g: number;
  readonly b: number;
  readonly a: number; // 0..1
}

export interface MapTheme {
  readonly background: MapColor;
  readonly surface: MapColor;
  readonly zoneFill: MapColor;
  readonly zoneStroke: MapColor;
  readonly zoneSelectedFill: MapColor;
  readonly glow: MapColor;
  readonly label: MapColor;
  readonly accent: MapColor;
  readonly fontFamily: string;
}

const FONT_WHITELIST = new Set(['Inter', 'JetBrainsMono', 'Quicksand']);

/** Accepts #RRGGBB or #AARRGGBB (leading # optional, case-insensitive). */
export function parseHexColor(raw: unknown): MapColor | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 6) s = `FF${s}`;
  if (s.length !== 8) return null;
  const n = Number.parseInt(s, 16);
  return {
    a: ((n >>> 24) & 0xff) / 255,
    r: (n >>> 16) & 0xff,
    g: (n >>> 8) & 0xff,
    b: n & 0xff,
  };
}

function hex(s: string): MapColor {
  const c = parseHexColor(s);
  if (c === null) throw new Error(`bad default color ${s}`);
  return c;
}

export const THEME_DEFAULTS: MapTheme = {
  background: hex('#03060B'),
  surface: hex('#111E30'),
  zoneFill: hex('#0A1220'),
  zoneStroke: hex('#4FC3FF'),
  zoneSelectedFill: hex('#7AE3FF'),
  glow: hex('#7AE3FF'),
  label: hex('#E8F4FF'),
  accent: hex('#FFB347'),
  fontFamily: 'Inter',
};

const DEFAULT_STROKE = hex('#4FC3FF');
const DEFAULT_SELECTED = hex('#7AE3FF');
const WHITE = hex('#E8F4FF');
const NEAR_BLACK = hex('#03060B');
const PURE_WHITE = hex('#FFFFFF');
const PURE_BLACK = hex('#000000');

// --- CSS + blending helpers -------------------------------------------------

export function colorCss(c: MapColor): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

/** Same RGB, explicit alpha (paint ops override the token alpha). */
export function colorAlpha(c: MapColor, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

export function lerpColor(a: MapColor, b: MapColor, t: number): MapColor {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: a.a + (b.a - a.a) * t,
  };
}

// --- WCAG math (§7.3) -------------------------------------------------------

function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relLuminance(c: MapColor): number {
  return (
    0.2126 * linearize(c.r / 255) +
    0.7152 * linearize(c.g / 255) +
    0.0722 * linearize(c.b / 255)
  );
}

export function contrastRatio(a: MapColor, b: MapColor): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function deltaL(a: MapColor, b: MapColor): number {
  return Math.abs(relLuminance(a) - relLuminance(b));
}

// --- Tuning constants (§7.4) ------------------------------------------------

const MAX_SURFACE_LUMINANCE = 0.22;
const LABEL_MIN_CONTRAST = 4.5;
const STROKE_MIN_CONTRAST = 3.0;
const MIN_SELECTION_DELTA_L = 0.06;

function pushLuminance(fill: MapColor, minDelta: number): MapColor {
  const target = relLuminance(fill) < 0.5 ? PURE_WHITE : PURE_BLACK;
  for (let t = 0.15; t < 1.0; t += 0.15) {
    const cand = lerpColor(fill, target, t);
    if (deltaL(cand, fill) >= minDelta) return cand;
  }
  return target;
}

/** Idempotent theme sanitizer (§7.4). */
export function sanitizeTheme(theme: MapTheme): MapTheme {
  // 1. Dark-guard.
  const background =
    relLuminance(theme.background) > MAX_SURFACE_LUMINANCE
      ? THEME_DEFAULTS.background
      : theme.background;
  const surface =
    relLuminance(theme.surface) > MAX_SURFACE_LUMINANCE ? THEME_DEFAULTS.surface : theme.surface;

  // 2. Font whitelist.
  const fontFamily = FONT_WHITELIST.has(theme.fontFamily) ? theme.fontFamily : 'Inter';

  // 3. Stroke contrast.
  const zoneStroke =
    contrastRatio(theme.zoneStroke, background) < STROKE_MIN_CONTRAST
      ? DEFAULT_STROKE
      : theme.zoneStroke;

  // 4. Selection visibility.
  let zoneSelectedFill = theme.zoneSelectedFill;
  if (deltaL(zoneSelectedFill, theme.zoneFill) < MIN_SELECTION_DELTA_L) {
    zoneSelectedFill = DEFAULT_SELECTED;
    if (deltaL(zoneSelectedFill, theme.zoneFill) < MIN_SELECTION_DELTA_L) {
      zoneSelectedFill = pushLuminance(theme.zoneFill, MIN_SELECTION_DELTA_L);
    }
  }

  // 5. Label contrast against all of [surface, zoneFill, selectedFill].
  const surfaces = [surface, theme.zoneFill, zoneSelectedFill];
  const worst = (label: MapColor): number =>
    Math.min(...surfaces.map((s) => contrastRatio(label, s)));
  let label = theme.label;
  if (worst(label) < LABEL_MIN_CONTRAST) {
    label = worst(WHITE) >= worst(NEAR_BLACK) ? WHITE : NEAR_BLACK;
  }

  return {
    background,
    surface,
    zoneFill: theme.zoneFill,
    zoneStroke,
    zoneSelectedFill,
    glow: theme.glow,
    label,
    accent: theme.accent,
    fontFamily,
  };
}

// --- Parsing ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Per-token tolerant parse; unknown/malformed tokens fall back to defaults. */
export function parseTheme(json: unknown): MapTheme {
  if (!isRecord(json)) return THEME_DEFAULTS;
  const color = (key: keyof MapTheme, fallback: MapColor): MapColor =>
    parseHexColor(json[key]) ?? fallback;
  const rawFont = json.fontFamily;
  const fontFamily =
    typeof rawFont === 'string' && FONT_WHITELIST.has(rawFont) ? rawFont : 'Inter';
  return {
    background: color('background', THEME_DEFAULTS.background),
    surface: color('surface', THEME_DEFAULTS.surface),
    zoneFill: color('zoneFill', THEME_DEFAULTS.zoneFill),
    zoneStroke: color('zoneStroke', THEME_DEFAULTS.zoneStroke),
    zoneSelectedFill: color('zoneSelectedFill', THEME_DEFAULTS.zoneSelectedFill),
    glow: color('glow', THEME_DEFAULTS.glow),
    label: color('label', THEME_DEFAULTS.label),
    accent: color('accent', THEME_DEFAULTS.accent),
    fontFamily,
  };
}

/** A per-zone override restricted to {zoneFill, zoneStroke, glow} (§7.2). */
export type ZoneThemeOverride = Partial<
  Pick<MapTheme, 'zoneFill' | 'zoneStroke' | 'glow'>
>;

/** Parse a raw themeOverride, restricting to the three honoured tokens. */
export function parseZoneOverride(json: unknown): ZoneThemeOverride | null {
  if (!isRecord(json)) return null;
  const out: {
    zoneFill?: MapColor;
    zoneStroke?: MapColor;
    glow?: MapColor;
  } = {};
  const zf = parseHexColor(json.zoneFill);
  const zs = parseHexColor(json.zoneStroke);
  const gl = parseHexColor(json.glow);
  if (zf !== null) out.zoneFill = zf;
  if (zs !== null) out.zoneStroke = zs;
  if (gl !== null) out.glow = gl;
  if (out.zoneFill === undefined && out.zoneStroke === undefined && out.glow === undefined) {
    return null;
  }
  return out;
}

/** Merge an override onto a base theme, then re-sanitize (§7.2). */
export function zoneTheme(base: MapTheme, override: ZoneThemeOverride | null): MapTheme {
  if (override === null) return base;
  return sanitizeTheme({ ...base, ...override });
}
