import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDocument } from '../data/parse';
import type { MapDocument } from './types';
import {
  compositeOver,
  contrastRatio,
  LABEL_MIN_CONTRAST,
  LABEL_SCRIM_ALPHA,
  lightestLabelScrim,
  parseHexColor,
  relLuminance,
  sanitizeTheme,
  THEME_DEFAULTS,
  zoneTheme,
  type MapColor,
  type MapTheme,
} from './theme';

function loadSeedDoc(id: string): MapDocument {
  const buf = readFileSync(`${process.cwd()}/public/maps-seed/${id}.map.json`);
  const res = validateDocument(JSON.parse(buf.toString('utf-8')), buf.byteLength);
  if (!res.ok) throw new Error(res.message);
  return res.value;
}

function hex(s: string): MapColor {
  const c = parseHexColor(s);
  if (c === null) throw new Error(s);
  return c;
}

const WHITE_BACKDROP = hex('#FFFFFF');

/** Every theme a map paints labels with: the base one and each zone override. */
function labelThemes(doc: MapDocument): MapTheme[] {
  const base = sanitizeTheme(doc.theme);
  return [base, ...doc.zones.map((z) => zoneTheme(base, z.themeOverride))];
}

/** The colours a label actually sits on: the scrim over the fills it covers. */
function scrimBackdrops(t: MapTheme): MapColor[] {
  const scrim = (under: MapColor) => compositeOver(t.background, LABEL_SCRIM_ALPHA, under);
  const tile = compositeOver(t.zoneFill, 0.62, t.background); // grid tile
  const selected = compositeOver(t.zoneSelectedFill, 0.6, tile); // selection on top
  return [scrim(t.background), scrim(tile), scrim(selected), scrim(WHITE_BACKDROP)];
}

describe('sanitizeTheme label contrast', () => {
  it('keeps Io labels light and ≥ 4.5:1 on the dark label scrim (was #03060B, 1.0:1)', () => {
    const io = loadSeedDoc('io');
    const themes = labelThemes(io);
    expect(themes.length).toBe(171);
    for (const t of themes) {
      // Io's own label (#FFF8DC) already passes, so the author's colour is kept.
      expect(t.label).toEqual(hex('#FFF8DC'));
      expect(relLuminance(t.label)).toBeGreaterThan(0.5);
      for (const backdrop of scrimBackdrops(t)) {
        expect(contrastRatio(t.label, backdrop)).toBeGreaterThanOrEqual(LABEL_MIN_CONTRAST);
      }
    }
  });

  it('meets 4.5:1 on the scrim for every seed map and zone override', () => {
    for (const id of ['io', 'venus', 'mars']) {
      for (const t of labelThemes(loadSeedDoc(id))) {
        expect(contrastRatio(t.label, lightestLabelScrim(t.background))).toBeGreaterThanOrEqual(
          LABEL_MIN_CONTRAST,
        );
      }
    }
  });

  it('never picks a dark label for light fills', () => {
    const t = sanitizeTheme({
      ...THEME_DEFAULTS,
      zoneFill: hex('#F2EBC0'),
      zoneSelectedFill: hex('#FFFFFF'),
      label: hex('#202020'),
    });
    expect(relLuminance(t.label)).toBeGreaterThan(0.5);
    expect(contrastRatio(t.label, lightestLabelScrim(t.background))).toBeGreaterThanOrEqual(
      LABEL_MIN_CONTRAST,
    );
  });

  it('falls back to the default background when no label can be legible on its scrim', () => {
    // Passes the luminance dark-guard (≤ 0.22) but is too light for a scrim.
    const grey = hex('#6A6A6A');
    expect(relLuminance(grey)).toBeLessThan(0.22);
    const t = sanitizeTheme({ ...THEME_DEFAULTS, background: grey });
    expect(t.background).toEqual(THEME_DEFAULTS.background);
    expect(contrastRatio(t.label, lightestLabelScrim(t.background))).toBeGreaterThanOrEqual(
      LABEL_MIN_CONTRAST,
    );
  });

  it('is idempotent', () => {
    const themes = [
      ...labelThemes(loadSeedDoc('io')).slice(0, 5),
      { ...THEME_DEFAULTS, background: hex('#6A6A6A') },
      { ...THEME_DEFAULTS, label: hex('#303030'), zoneFill: hex('#EEEEEE') },
    ];
    for (const t of themes) {
      const once = sanitizeTheme(t);
      expect(sanitizeTheme(once)).toEqual(once);
    }
  });
});
