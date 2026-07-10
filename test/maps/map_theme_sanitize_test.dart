import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/design_system/colors.dart';
import 'package:underdeck_app/design_system/typography.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_theme.dart';

// Independent WCAG re-implementation so the tests assert the *contract*, not the
// production helpers (which are private anyway).
double _lin(double c) =>
    c <= 0.03928 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
double _lum(Color c) =>
    0.2126 * _lin(c.r) + 0.7152 * _lin(c.g) + 0.0722 * _lin(c.b);
double _contrast(Color a, Color b) {
  final la = _lum(a), lb = _lum(b);
  final hi = math.max(la, lb), lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/// Builds a MapTheme directly (bypassing fromJson) so we can inject hostile
/// token values a strict parser would otherwise not produce.
MapTheme _theme({
  Color background = const Color(0xFF05070D),
  Color surface = const Color(0xFF101B2E),
  Color zoneFill = const Color(0xFF1E3A55),
  Color zoneStroke = const Color(0xFF4FC3FF),
  Color zoneSelectedFill = const Color(0xFF7AE3FF),
  Color glow = const Color(0xFF7AE3FF),
  Color label = const Color(0xFFE8F4FF),
  Color accent = const Color(0xFFFFB347),
  String fontFamily = AppTypography.fontSans,
}) =>
    MapTheme(
      background: background,
      surface: surface,
      zoneFill: zoneFill,
      zoneStroke: zoneStroke,
      zoneSelectedFill: zoneSelectedFill,
      glow: glow,
      label: label,
      accent: accent,
      fontFamily: fontFamily,
    );

void main() {
  group('MapTheme.sanitize dark-guard', () {
    test('light background/surface are clipped to the dark defaults', () {
      final s = _theme(
        background: const Color(0xFFFFFFFF),
        surface: const Color(0xFFEEEEEE),
      ).sanitize();
      expect(s.background, MapTheme.defaults.background);
      expect(s.surface, MapTheme.defaults.surface);
      expect(_lum(s.background), lessThanOrEqualTo(kMapMaxSurfaceLuminance));
      expect(_lum(s.surface), lessThanOrEqualTo(kMapMaxSurfaceLuminance));
    });

    test('an already-dark background/surface is left untouched', () {
      const bg = Color(0xFF05070D);
      const sur = Color(0xFF101B2E);
      final s = _theme(background: bg, surface: sur).sanitize();
      expect(s.background, bg);
      expect(s.surface, sur);
    });
  });

  group('MapTheme.sanitize contrast guards', () {
    test('a low-contrast label over dark surfaces is substituted', () {
      // A near-black label on the dark default surfaces fails 4.5:1.
      final original = _theme(label: const Color(0xFF0A1220));
      expect(_contrast(original.label, original.surface),
          lessThan(kMapLabelMinContrast));

      final s = original.sanitize();
      expect(s.label, isNot(const Color(0xFF0A1220)));
      // Dark surfaces ⇒ the light default wins the worst-case contrast search.
      expect(s.label, AppColors.textPrimary);
      expect(_contrast(s.label, s.surface),
          greaterThanOrEqualTo(kMapLabelMinContrast));
      expect(_contrast(s.label, s.zoneFill),
          greaterThanOrEqualTo(kMapLabelMinContrast));
    });

    test('a low-contrast zone stroke over the background is substituted', () {
      // Stroke almost equal to the (dark) background ⇒ < 3:1.
      final s = _theme(zoneStroke: const Color(0xFF0A0D14)).sanitize();
      expect(s.zoneStroke, MapTheme.defaults.zoneStroke);
      expect(_contrast(s.zoneStroke, s.background),
          greaterThanOrEqualTo(kMapStrokeMinContrast));
    });
  });

  group('MapTheme.sanitize font guard', () {
    test('a non-whitelisted font falls back to Inter', () {
      final s = _theme(fontFamily: 'Comic Sans').sanitize();
      expect(s.fontFamily, AppTypography.fontSans);
    });

    test('a whitelisted font is preserved', () {
      final s = _theme(fontFamily: AppTypography.fontMono).sanitize();
      expect(s.fontFamily, AppTypography.fontMono);
    });
  });

  group('MapTheme.sanitize selection visibility', () {
    test('selected fill equal to base fill is separated (default suffices)', () {
      const fill = Color(0xFF1E3A55);
      final s = _theme(zoneFill: fill, zoneSelectedFill: fill).sanitize();
      expect(s.zoneSelectedFill, isNot(fill));
      expect((_lum(s.zoneSelectedFill) - _lum(fill)).abs(),
          greaterThanOrEqualTo(kMapMinSelectionDeltaL));
      // The bright default is far enough from the dark fill to be picked as-is.
      expect(s.zoneSelectedFill, MapTheme.defaults.zoneSelectedFill);
    });

    test('selected fill is pushed when even the default is too close', () {
      // Base fill == the default selected fill ⇒ default cannot separate it,
      // so sanitize must push the luminance until ΔL is met.
      final fill = MapTheme.defaults.zoneSelectedFill;
      final s = _theme(zoneFill: fill, zoneSelectedFill: fill).sanitize();
      expect(s.zoneSelectedFill, isNot(fill));
      expect((_lum(s.zoneSelectedFill) - _lum(fill)).abs(),
          greaterThanOrEqualTo(kMapMinSelectionDeltaL));
    });
  });

  group('MapTheme.sanitize invariants', () {
    test('a fully dark-safe theme is returned unchanged', () {
      final t = _theme();
      final s = t.sanitize();
      expect(s.background, t.background);
      expect(s.surface, t.surface);
      expect(s.zoneFill, t.zoneFill);
      expect(s.zoneStroke, t.zoneStroke);
      expect(s.zoneSelectedFill, t.zoneSelectedFill);
      expect(s.label, t.label);
      expect(s.fontFamily, t.fontFamily);
    });

    test('sanitize is idempotent on a hostile theme', () {
      final once = _theme(
        background: const Color(0xFFFFFFFF),
        surface: const Color(0xFFCCCCCC),
        label: const Color(0xFF0A1220),
        zoneStroke: const Color(0xFF0A0D14),
        zoneFill: const Color(0xFF1E3A55),
        zoneSelectedFill: const Color(0xFF1E3A55),
        fontFamily: 'Papyrus',
      ).sanitize();
      final twice = once.sanitize();
      expect(twice.background, once.background);
      expect(twice.surface, once.surface);
      expect(twice.zoneStroke, once.zoneStroke);
      expect(twice.zoneSelectedFill, once.zoneSelectedFill);
      expect(twice.label, once.label);
      expect(twice.fontFamily, once.fontFamily);
    });
  });

  group('MapThemeOverride zone-token restriction', () {
    test('zoneRestricted keeps only {zoneFill, zoneStroke, glow}', () {
      final o = MapThemeOverride.fromJson({
        'background': '#112233',
        'surface': '#223344',
        'label': '#445566',
        'fontFamily': 'JetBrainsMono',
        'zoneFill': '#0F0F0F',
        'zoneStroke': '#101010',
        'glow': '#111111',
      }).zoneRestricted();

      expect(o.zoneFill, const Color(0xFF0F0F0F));
      expect(o.zoneStroke, const Color(0xFF101010));
      expect(o.glow, const Color(0xFF111111));
      expect(o.background, isNull);
      expect(o.surface, isNull);
      expect(o.label, isNull);
      expect(o.accent, isNull);
      expect(o.zoneSelectedFill, isNull);
      expect(o.fontFamily, isNull);
    });

    test('MapZone.fromJson drops disallowed override tokens at parse', () {
      final z = MapZone.fromJson({
        'id': 'z1',
        'name': 'Zone One',
        'geometry': {
          'kind': 'polygon',
          'rings': [
            [
              [0, 0],
              [10, 0],
              [10, 10],
            ],
          ],
        },
        'themeOverride': {
          'background': '#FFFFFF',
          'label': '#000000',
          'zoneFill': '#123456',
        },
      });
      expect(z.themeOverride, isNotNull);
      expect(z.themeOverride!.zoneFill, const Color(0xFF123456));
      expect(z.themeOverride!.background, isNull);
      expect(z.themeOverride!.label, isNull);
    });

    test('MapZone.fromJson nulls an override with only disallowed tokens', () {
      final z = MapZone.fromJson({
        'id': 'z1',
        'name': 'Zone One',
        'geometry': {
          'kind': 'marker',
          'at': [1, 2],
          'hitRadius': 5,
        },
        'themeOverride': {'background': '#FFFFFF', 'label': '#000000'},
      });
      expect(z.themeOverride, isNull);
    });
  });
}
