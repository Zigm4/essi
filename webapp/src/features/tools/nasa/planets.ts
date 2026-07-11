/**
 * Planet reference table for System Scan (tools-live spec §4.3, §4.5, §4.6).
 * The 9 bodies in fixed order, their NAIF codes, serialized emojis, glyph
 * palette, and per-planet Full-mode sweep windows.
 */

const ACCENT_SECONDARY = '#7AE3FF';

export interface GlyphColors {
  diameter: number;
  light: string;
  dark: string;
  scan: string;
}

export interface FullWindow {
  broadDays: number;
  broadStep: string;
  /** ± hours around the rough transition for the refinement sweep. */
  precisionHalfWindowHours: number;
  precisionStep: string;
}

export interface PlanetSpec {
  name: string;
  /** NAIF body code, e.g. '199' for Mercury. */
  code: string;
  emoji: string;
  hasRing: boolean;
  glyph: GlyphColors;
  window: FullWindow;
}

const DEFAULT_WINDOW: FullWindow = {
  broadDays: 60,
  broadStep: '1h',
  precisionHalfWindowHours: 12,
  precisionStep: '1m',
};

export const PLANETS: readonly PlanetSpec[] = [
  {
    name: 'Mercury',
    code: '199',
    emoji: '☿',
    hasRing: false,
    glyph: { diameter: 11, light: '#C8B594', dark: '#6F5F44', scan: ACCENT_SECONDARY },
    window: DEFAULT_WINDOW,
  },
  {
    name: 'Venus',
    code: '299',
    emoji: '♀',
    hasRing: false,
    glyph: { diameter: 18, light: '#F0C988', dark: '#9C6E2F', scan: ACCENT_SECONDARY },
    window: DEFAULT_WINDOW,
  },
  {
    name: 'Earth',
    code: '399',
    emoji: '🌍',
    hasRing: false,
    glyph: { diameter: 18, light: '#6CB4F7', dark: '#2C5990', scan: '#9DDCFF' },
    window: DEFAULT_WINDOW,
  },
  {
    name: 'Mars',
    code: '499',
    emoji: '♂',
    hasRing: false,
    glyph: { diameter: 14, light: '#E8745A', dark: '#8C2E1A', scan: '#FFB0A0' },
    window: DEFAULT_WINDOW,
  },
  {
    name: 'Jupiter',
    code: '599',
    emoji: '♃',
    hasRing: false,
    glyph: { diameter: 26, light: '#E8B270', dark: '#8E5826', scan: '#FFD79A' },
    window: { broadDays: 540, broadStep: '12h', precisionHalfWindowHours: 18, precisionStep: '5m' },
  },
  {
    name: 'Saturn',
    code: '699',
    emoji: '♄',
    hasRing: true,
    glyph: { diameter: 22, light: '#F0DA9C', dark: '#9C7E36', scan: ACCENT_SECONDARY },
    window: {
      broadDays: 4 * 365,
      broadStep: '1d',
      precisionHalfWindowHours: 48,
      precisionStep: '30m',
    },
  },
  {
    name: 'Uranus',
    code: '799',
    emoji: '♅',
    hasRing: false,
    glyph: { diameter: 19, light: '#9CEBE0', dark: '#3F8478', scan: '#9DDCFF' },
    window: {
      broadDays: 10 * 365,
      broadStep: '2d',
      precisionHalfWindowHours: 72,
      precisionStep: '1h',
    },
  },
  {
    name: 'Neptune',
    code: '899',
    emoji: '♆',
    hasRing: false,
    glyph: { diameter: 19, light: '#6F88F0', dark: '#2C3FA2', scan: '#9DDCFF' },
    window: {
      broadDays: 20 * 365,
      broadStep: '7d',
      precisionHalfWindowHours: 240,
      precisionStep: '6h',
    },
  },
  {
    name: 'Pluto',
    code: '999',
    emoji: '♇',
    hasRing: false,
    glyph: { diameter: 10, light: '#C2A8C4', dark: '#694E6B', scan: ACCENT_SECONDARY },
    window: {
      broadDays: 30 * 365,
      broadStep: '14d',
      precisionHalfWindowHours: 480,
      precisionStep: '12h',
    },
  },
];
