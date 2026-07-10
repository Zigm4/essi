import 'dart:math' as math;
import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';

import 'package:underdeck_app/design_system/colors.dart';
import 'package:underdeck_app/design_system/typography.dart';

// --- WCAG / dark-guard tuning constants (AUDIT-V2 §4.6) ----------------------

/// Backgrounds/surfaces above this WCAG relative luminance are clipped to the
/// app default. The glass/neon design system assumes dark surfaces; a light
/// content-supplied background breaks every overlay component.
const double kMapMaxSurfaceLuminance = 0.22;

/// Minimum WCAG contrast ratio for label text against the surfaces it can be
/// read over (surface panel + the zone fills). AA body-text threshold.
const double kMapLabelMinContrast = 4.5;

/// Minimum WCAG contrast ratio for the zone stroke against the background so an
/// outline is actually visible. AA non-text/UI threshold.
const double kMapStrokeMinContrast = 3.0;

/// Minimum difference in relative luminance between the selected-zone fill and
/// the base zone fill, so selection is perceptible even when both are tinted
/// the same hue. (A pure hue swap at equal luminance reads as "no change".)
const double kMapMinSelectionDeltaL = 0.06;

/// Font families the content may request. Restricted to the three families
/// bundled with the app (see pubspec `fonts:`); anything else falls back to the
/// per-token default.
const Set<String> kMapFontWhitelist = {
  AppTypography.fontSans, // 'Inter'
  AppTypography.fontMono, // 'JetBrainsMono'
  AppTypography.fontRounded, // 'Quicksand'
};

/// Parses `#RRGGBB` or `#AARRGGBB` (leading `#` optional, case-insensitive).
/// Returns `null` on anything malformed so callers fall back to a default.
Color? parseHexColor(Object? raw) {
  if (raw is! String) return null;
  var s = raw.trim();
  if (s.startsWith('#')) s = s.substring(1);
  if (s.length == 6) s = 'FF$s'; // opaque RRGGBB -> AARRGGBB
  if (s.length != 8) return null;
  final v = int.tryParse(s, radix: 16);
  if (v == null) return null;
  return Color(v);
}

/// The 9 closed theme tokens for a map, all resolved (no nulls).
///
/// [fromJson] is per-token tolerant: each token that is missing or malformed
/// falls back to the [MapTheme.defaults] value derived from [AppColors].
///
/// NOTE: this type intentionally only *parses and defaults* the tokens. The
/// full [sanitize] pass — dark-only luminance guard, WCAG contrast guards,
/// label halo/scrim, minimum ΔL between selected/base fill — is owned by a
/// separate agent (AUDIT-V2 §4.6). The seam is [sanitize] below.
@immutable
class MapTheme {
  final Color background;
  final Color surface;
  final Color zoneFill;
  final Color zoneStroke;
  final Color zoneSelectedFill;
  final Color glow;
  final Color label;
  final Color accent;
  final String fontFamily;

  const MapTheme({
    required this.background,
    required this.surface,
    required this.zoneFill,
    required this.zoneStroke,
    required this.zoneSelectedFill,
    required this.glow,
    required this.label,
    required this.accent,
    required this.fontFamily,
  });

  /// App defaults, derived from [AppColors]. Every token falls back here.
  static const MapTheme defaults = MapTheme(
    background: AppColors.bgDeepest,
    surface: AppColors.bgCard,
    zoneFill: AppColors.bgElevated,
    zoneStroke: AppColors.accentPrimary,
    zoneSelectedFill: AppColors.accentSecondary,
    glow: AppColors.accentSecondary,
    label: AppColors.textPrimary,
    accent: AppColors.accentWarn,
    fontFamily: AppTypography.fontSans,
  );

  factory MapTheme.fromJson(Map<String, dynamic>? j) {
    j ??= const {};
    return MapTheme(
      background: parseHexColor(j['background']) ?? defaults.background,
      surface: parseHexColor(j['surface']) ?? defaults.surface,
      zoneFill: parseHexColor(j['zoneFill']) ?? defaults.zoneFill,
      zoneStroke: parseHexColor(j['zoneStroke']) ?? defaults.zoneStroke,
      zoneSelectedFill:
          parseHexColor(j['zoneSelectedFill']) ?? defaults.zoneSelectedFill,
      glow: parseHexColor(j['glow']) ?? defaults.glow,
      label: parseHexColor(j['label']) ?? defaults.label,
      accent: parseHexColor(j['accent']) ?? defaults.accent,
      fontFamily: _parseFont(j['fontFamily']) ?? defaults.fontFamily,
    );
  }

  /// Applies a per-zone [MapThemeOverride], returning a new theme with only the
  /// overridden tokens replaced.
  MapTheme withOverride(MapThemeOverride? o) {
    if (o == null) return this;
    return MapTheme(
      background: o.background ?? background,
      surface: o.surface ?? surface,
      zoneFill: o.zoneFill ?? zoneFill,
      zoneStroke: o.zoneStroke ?? zoneStroke,
      zoneSelectedFill: o.zoneSelectedFill ?? zoneSelectedFill,
      glow: o.glow ?? glow,
      label: o.label ?? label,
      accent: o.accent ?? accent,
      fontFamily: o.fontFamily ?? fontFamily,
    );
  }

  /// Per-token guard pass applied after parsing, before the theme reaches the
  /// render layer (AUDIT-V2 §4.6). Hostile / low-effort content can request any
  /// colours; this clamps them back into a legible, dark-only envelope:
  ///
  /// - **dark-guard**: `background`/`surface` whose WCAG relative luminance
  ///   exceeds [kMapMaxSurfaceLuminance] are clipped to the app default (the
  ///   glass/neon components assume a dark canvas);
  /// - **stroke contrast**: `zoneStroke` must clear [kMapStrokeMinContrast]
  ///   against the (guarded) background, else it falls back to the default;
  /// - **selection visibility**: `zoneSelectedFill` must differ from `zoneFill`
  ///   by at least [kMapMinSelectionDeltaL] in relative luminance, else it is
  ///   nudged (default first, then a luminance push) until it does;
  /// - **label contrast**: `label` must clear [kMapLabelMinContrast] against the
  ///   surface AND both zone fills; if not, it is replaced with whichever of the
  ///   light/dark defaults maximises the worst-case contrast.
  ///
  /// NOTE (for the render agent): the label guard here is best-effort — labels
  /// are ultimately painted over the *background image*, which the theme cannot
  /// see. A systematic label **scrim/halo** behind every label is a
  /// rendering-engine property (non-bypassable by content) and remains the real
  /// legibility guarantee; these token guards are belt-and-suspenders for the
  /// panel/fill surfaces the theme *can* reason about.
  ///
  /// Idempotent: `t.sanitize().sanitize() == t.sanitize()`.
  MapTheme sanitize() {
    final bg = _darkGuard(background, defaults.background);
    final sur = _darkGuard(surface, defaults.surface);
    final font = kMapFontWhitelist.contains(fontFamily)
        ? fontFamily
        : defaults.fontFamily;

    // Zone stroke must be visible against the (guarded) background.
    final stroke = _contrastRatio(zoneStroke, bg) >= kMapStrokeMinContrast
        ? zoneStroke
        : defaults.zoneStroke;

    // Selection must be perceptibly different from the base fill.
    var selected = zoneSelectedFill;
    if (_deltaL(selected, zoneFill) < kMapMinSelectionDeltaL) {
      selected = defaults.zoneSelectedFill;
      if (_deltaL(selected, zoneFill) < kMapMinSelectionDeltaL) {
        selected = _pushLuminance(zoneFill, kMapMinSelectionDeltaL);
      }
    }

    // Label must read on the surface panel and over both fills.
    final surfaces = <Color>[sur, zoneFill, selected];
    final label = _labelReadable(this.label, surfaces)
        ? this.label
        : _bestLabel(const [AppColors.textPrimary, AppColors.bgDeepest], surfaces);

    return MapTheme(
      background: bg,
      surface: sur,
      zoneFill: zoneFill,
      zoneStroke: stroke,
      zoneSelectedFill: selected,
      glow: glow,
      label: label,
      accent: accent,
      fontFamily: font,
    );
  }

  static bool _labelReadable(Color label, List<Color> surfaces) =>
      surfaces.every((s) => _contrastRatio(label, s) >= kMapLabelMinContrast);

  /// Picks the candidate label colour with the highest worst-case contrast
  /// across [surfaces] (so the least-legible surface is as legible as possible).
  static Color _bestLabel(List<Color> candidates, List<Color> surfaces) {
    Color best = candidates.first;
    double bestMin = -1;
    for (final c in candidates) {
      final worst = surfaces
          .map((s) => _contrastRatio(c, s))
          .reduce((a, b) => a < b ? a : b);
      if (worst > bestMin) {
        bestMin = worst;
        best = c;
      }
    }
    return best;
  }

  /// Clips [c] to [fallback] when its relative luminance is too high for the
  /// dark-only design system.
  static Color _darkGuard(Color c, Color fallback) =>
      _relLuminance(c) <= kMapMaxSurfaceLuminance ? c : fallback;

  /// Returns a colour whose relative luminance differs from [fill] by at least
  /// [minDelta], by blending [fill] toward white (if it is dark) or black.
  static Color _pushLuminance(Color fill, double minDelta) {
    final lf = _relLuminance(fill);
    final target = lf < 0.5 ? const Color(0xFFFFFFFF) : const Color(0xFF000000);
    for (var t = 0.15; t < 1.0; t += 0.15) {
      final c = Color.lerp(fill, target, t)!;
      if ((_relLuminance(c) - lf).abs() >= minDelta) return c;
    }
    return target;
  }

  static double _deltaL(Color a, Color b) =>
      (_relLuminance(a) - _relLuminance(b)).abs();
}

// --- WCAG relative-luminance / contrast math (sRGB) --------------------------

double _linearizeChannel(double c) => c <= 0.03928
    ? c / 12.92
    : math.pow((c + 0.055) / 1.055, 2.4).toDouble();

/// WCAG 2.x relative luminance of [c] (alpha ignored — compositing over the
/// background image is the render layer's scrim job, not the theme's).
double _relLuminance(Color c) =>
    0.2126 * _linearizeChannel(c.r) +
    0.7152 * _linearizeChannel(c.g) +
    0.0722 * _linearizeChannel(c.b);

/// WCAG contrast ratio between two colours, in [1, 21].
double _contrastRatio(Color a, Color b) {
  final la = _relLuminance(a);
  final lb = _relLuminance(b);
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/// A partial [MapTheme] — only the tokens present in the JSON are set; the rest
/// are `null` and inherit from the map-level theme. Used by `MapZone.themeOverride`.
@immutable
class MapThemeOverride {
  final Color? background;
  final Color? surface;
  final Color? zoneFill;
  final Color? zoneStroke;
  final Color? zoneSelectedFill;
  final Color? glow;
  final Color? label;
  final Color? accent;
  final String? fontFamily;

  const MapThemeOverride({
    this.background,
    this.surface,
    this.zoneFill,
    this.zoneStroke,
    this.zoneSelectedFill,
    this.glow,
    this.label,
    this.accent,
    this.fontFamily,
  });

  bool get isEmpty =>
      background == null &&
      surface == null &&
      zoneFill == null &&
      zoneStroke == null &&
      zoneSelectedFill == null &&
      glow == null &&
      label == null &&
      accent == null &&
      fontFamily == null;

  /// Per-zone overrides are intentionally restricted to the three *zone-scoped*
  /// tokens ({zoneFill, zoneStroke, glow}) — a zone cannot repaint the whole
  /// map's background/surface/label/font (that would defeat the map-level
  /// dark-guard + contrast sanitization). Returns a copy with every other token
  /// dropped; enforced at parse in [MapZone.fromJson] (AUDIT-V2 §4.6).
  MapThemeOverride zoneRestricted() => MapThemeOverride(
        zoneFill: zoneFill,
        zoneStroke: zoneStroke,
        glow: glow,
      );

  factory MapThemeOverride.fromJson(Map<String, dynamic>? j) {
    j ??= const {};
    return MapThemeOverride(
      background: parseHexColor(j['background']),
      surface: parseHexColor(j['surface']),
      zoneFill: parseHexColor(j['zoneFill']),
      zoneStroke: parseHexColor(j['zoneStroke']),
      zoneSelectedFill: parseHexColor(j['zoneSelectedFill']),
      glow: parseHexColor(j['glow']),
      label: parseHexColor(j['label']),
      accent: parseHexColor(j['accent']),
      fontFamily: _parseFont(j['fontFamily']),
    );
  }
}

String? _parseFont(Object? raw) =>
    (raw is String && kMapFontWhitelist.contains(raw)) ? raw : null;

/// Resolves a zone's effective theme from an already-sanitized [base] map theme
/// and its (restricted) [override]. The override's zone-scoped tokens
/// ({zoneFill, zoneStroke, glow}) are re-run through [MapTheme.sanitize] so a
/// per-zone standout colour still clears the contrast / selection guards (§4.6) —
/// content cannot dim a stroke into invisibility or hide selection. Zones with no
/// override return [base] unchanged (sanitize is idempotent, so this is a no-op).
MapTheme zoneTheme(MapTheme base, MapThemeOverride? override) =>
    override == null ? base : base.withOverride(override).sanitize();
