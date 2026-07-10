import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';

import '../domain/map_geometry.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import 'sphere_math.dart';
import 'zone_paint_ops.dart';

/// Fraction of the viewport's shorter half-axis the globe fills at zoom 1.0.
/// Shared by [globeRadiusFor] and the gesture math in `GlobeViewport` so tap
/// picking and drawing agree exactly.
const double kGlobeFillFactor = 0.92;

/// Radius (px) of the drawn globe for a viewport [size] at the given [zoom].
double globeRadiusFor(Size size, double zoom) =>
    math.min(size.width, size.height) / 2 * kGlobeFillFactor * zoom;

/// Centre (px) of the drawn globe for a viewport [size].
Offset globeCenterFor(Size size) => Offset(size.width / 2, size.height / 2);

/// Minimum on-screen globe radius (px) at which zone labels are drawn (LOD): a
/// small globe would only smear its labels.
const double _kLabelMinRadius = 120.0;

/// Number of segments used to tessellate a [SphericalCapGeometry] boundary into
/// a drawable ring.
const int _kCapSegments = 48;

// --- render model ------------------------------------------------------------

/// Precomputed, immutable render data for one globe zone. World-space rings are
/// densified **once** here; the painter only projects them per frame.
@immutable
class SphereRenderItem {
  final String zoneId;

  /// Resolved zone theme (map theme + restricted override), already sanitized.
  final MapTheme theme;

  /// Densified rings in geographic space: `[outline, hole, …]` for a spherical
  /// polygon, or a single boundary ring for a cap. Never empty for a drawable
  /// zone.
  final List<List<GeoPoint>> rings;

  /// Representative interior point, used for front-hemisphere culling and label
  /// placement.
  final GeoPoint centroid;

  /// Label glyphs, laid out once; repositioned per frame. `null` for an unnamed
  /// zone.
  final TextPainter? label;

  const SphereRenderItem({
    required this.zoneId,
    required this.theme,
    required this.rings,
    required this.centroid,
    required this.label,
  });
}

/// Fully precomputed render model for a sphere [MapDocument]. Build once (it lays
/// out labels + densifies rings); the [GlobePainter] then only projects.
@immutable
class SphereRender {
  /// The sanitized map-level theme (drives the shaded disc + rim glow).
  final MapTheme theme;
  final List<SphereRenderItem> items;
  final double labelFontSize;

  const SphereRender({
    required this.theme,
    required this.items,
    required this.labelFontSize,
  });
}

/// Builds a [SphereRender] from a parsed sphere [MapDocument]. Flat / unknown
/// geometries contribute nothing (they carry empty rings and are skipped).
///
/// Must run with a live Flutter binding (it lays out label text).
SphereRender buildSphereRender(MapDocument doc) {
  final base = doc.theme.sanitize();
  const fontSize = 26.0;

  final items = <SphereRenderItem>[];
  for (final z in doc.zones) {
    final rings = _ringsFor(z.geometry);
    if (rings.isEmpty) continue; // not a spherical geometry
    final theme = zoneTheme(base, z.themeOverride);
    items.add(SphereRenderItem(
      zoneId: z.id,
      theme: theme,
      rings: rings,
      centroid: _centroid(rings.first),
      label: z.name.isEmpty ? null : _buildLabel(z.name, fontSize, theme),
    ));
  }

  return SphereRender(theme: base, items: items, labelFontSize: fontSize);
}

/// Densified geographic rings for a zone's geometry, or `const []` for a
/// non-spherical geometry (which the globe cannot draw).
List<List<GeoPoint>> _ringsFor(ZoneGeometry g) {
  switch (g) {
    case SphericalPolygonGeometry():
      return [for (final r in g.rings) tessellateRing(r)];
    case SphericalCapGeometry():
      return [_capBoundary(g.center, g.radiusDeg)];
    case PolygonGeometry():
    case MarkerGeometry():
    case UnknownGeometry():
      return const [];
  }
}

TextPainter _buildLabel(String name, double fontSize, MapTheme theme) {
  return TextPainter(
    text: TextSpan(
      text: name,
      style: TextStyle(
        fontFamily: theme.fontFamily,
        fontSize: fontSize,
        height: 1.05,
        fontWeight: FontWeight.w600,
        color: theme.label,
        decoration: TextDecoration.none,
      ),
    ),
    textAlign: TextAlign.center,
    textDirection: TextDirection.ltr,
    maxLines: 2,
    ellipsis: '…',
  )..layout(maxWidth: fontSize * 12);
}

// --- painter -----------------------------------------------------------------

/// Draws the stylized neon globe (AUDIT-V2 §4.5 Plan A): a radial-shaded disc
/// with a rim glow, then every front-hemisphere zone's themed fill + neon
/// stroke, the selected zone's highlight, and LOD-gated labels with scrims.
///
/// No `FragmentProgram`/texture is used — a stylized neon globe fits the app and
/// avoids the shader-on-device risk. See the clearly-marked TEXTURE SEAM in
/// [paint] for where an optional equirectangular sampler would slot in later.
///
/// Driven by a repaint [Listenable] (orientation + zoom + selection), so frames
/// advance with no widget rebuild.
class GlobePainter extends CustomPainter {
  final SphereRender render;
  final ValueListenable<GlobeOrientation> orientation;
  final ValueListenable<double> zoom;
  final ValueListenable<String?> selected;

  /// Zone ids failing the active filter — drawn dimmed (~30% opacity). Empty
  /// (the default) when no filter is active.
  final ValueListenable<Set<String>> dimmed;

  GlobePainter({
    required this.render,
    required this.orientation,
    required this.zoom,
    required this.selected,
    ValueListenable<Set<String>>? dimmed,
  })  : dimmed = dimmed ?? _kNoDim,
        super(
          repaint: Listenable.merge([orientation, zoom, selected, ?dimmed]),
        );

  static final ValueNotifier<Set<String>> _kNoDim =
      ValueNotifier<Set<String>>(const {});

  @override
  void paint(Canvas canvas, Size size) {
    final center = globeCenterFor(size);
    final radius = globeRadiusFor(size, zoom.value);
    if (radius <= 0) return;
    final orient = orientation.value;
    final theme = render.theme;
    final selectedId = selected.value;
    final dimmedIds = dimmed.value;

    _paintDisc(canvas, center, radius, theme);

    // TEXTURE SEAM: to render an equirectangular surface texture later, sample
    // it here into the disc (a FragmentProgram fed the inverse-orientation
    // matrix, or a CPU-warped ImageShader). The MVP intentionally ships without
    // one — see class doc. The zone/label passes below are texture-agnostic.

    final strokeWidth = (radius * 0.012).clamp(1.5, 6.0);

    // Zones are clipped to the disc so any limb overflow is trimmed cleanly.
    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: center, radius: radius)));

    SphereRenderItem? selectedItem;
    for (final item in render.items) {
      if (item.zoneId == selectedId) {
        selectedItem = item; // drawn last, on top
        continue;
      }
      _paintZone(canvas, item, orient, radius, center, strokeWidth,
          selected: false, dimmed: dimmedIds.contains(item.zoneId));
    }
    if (selectedItem != null) {
      // A selected zone is never dimmed — selection wins over the filter.
      _paintZone(canvas, selectedItem, orient, radius, center, strokeWidth,
          selected: true, dimmed: false);
    }
    canvas.restore();

    _paintRim(canvas, center, radius, theme);

    if (radius >= _kLabelMinRadius) {
      for (final item in render.items) {
        _paintLabel(canvas, item, orient, radius, center,
            dimmed: dimmedIds.contains(item.zoneId));
      }
    }
  }

  /// Radial-shaded sphere body: a lit highlight toward the upper-left fading to
  /// a dark terminator at the lower-right.
  void _paintDisc(Canvas canvas, Offset center, double radius, MapTheme theme) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    final lit = Color.lerp(theme.surface, theme.glow, 0.22)!;
    final mid = theme.surface;
    final dark = Color.lerp(theme.background, const Color(0xFF000000), 0.35)!;
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.45, -0.5),
          radius: 1.15,
          colors: [lit, mid, dark],
          stops: const [0.0, 0.55, 1.0],
        ).createShader(rect),
    );
  }

  /// Neon rim: a blurred glow ring hugging the silhouette.
  void _paintRim(Canvas canvas, Offset center, double radius, MapTheme theme) {
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.02
        ..color = theme.glow.withValues(alpha: 0.55)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.03),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.006
        ..color = theme.glow.withValues(alpha: 0.35),
    );
  }

  /// Projects and fills one zone, only when it faces the camera. Back-hemisphere
  /// zones (centroid pointing away) are culled; vertices that dip behind the limb
  /// are clamped onto it so the silhouette never folds inward.
  void _paintZone(
    Canvas canvas,
    SphereRenderItem item,
    GlobeOrientation orient,
    double radius,
    Offset center,
    double strokeWidth, {
    required bool selected,
    required bool dimmed,
  }) {
    final c = project(item.centroid, orient, radius, center);
    if (!c.front) return; // whole zone is on the far hemisphere

    final path = Path();
    for (final ring in item.rings) {
      if (ring.length < 2) continue;
      var moved = false;
      for (final g in ring) {
        final o = _projectClamped(g, orient, radius, center);
        if (!moved) {
          path.moveTo(o.dx, o.dy);
          moved = true;
        } else {
          path.lineTo(o.dx, o.dy);
        }
      }
      path.close();
    }
    path.fillType = PathFillType.evenOdd;
    if (dimmed) {
      // Fade the whole zone glyph together (~30% opacity) via a layer.
      canvas.saveLayer(
        path.getBounds().inflate(strokeWidth * 4 + 8),
        Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.30),
      );
      paintPolygonZone(canvas, path, item.theme,
          strokeWidth: strokeWidth, selected: selected);
      canvas.restore();
    } else {
      paintPolygonZone(canvas, path, item.theme,
          strokeWidth: strokeWidth, selected: selected);
    }
  }

  void _paintLabel(
    Canvas canvas,
    SphereRenderItem item,
    GlobeOrientation orient,
    double radius,
    Offset center, {
    required bool dimmed,
  }) {
    final label = item.label;
    if (label == null) return;
    final p = project(item.centroid, orient, radius, center);
    // Only label zones facing the camera and comfortably off the limb (where the
    // projection compresses and text would crowd the edge).
    if (!p.front) return;
    if ((p.screen - center).distance > radius * 0.82) return;

    final topLeft = p.screen - Offset(label.width / 2, label.height / 2);
    final padX = render.labelFontSize * 0.45;
    final padY = render.labelFontSize * 0.28;
    final scrim = RRect.fromRectAndRadius(
      Rect.fromLTWH(topLeft.dx - padX, topLeft.dy - padY,
          label.width + padX * 2, label.height + padY * 2),
      Radius.circular(render.labelFontSize * 0.5),
    );
    if (dimmed) canvas.saveLayer(scrim.outerRect.inflate(4), _dimLayerPaint);
    // Systematic scrim behind every label (engine guarantee, §4.6): legible over
    // the shaded body and any zone fill regardless of content colours.
    canvas.drawRRect(
      scrim,
      Paint()..color = item.theme.background.withValues(alpha: 0.72),
    );
    label.paint(canvas, topLeft);
    if (dimmed) canvas.restore();
  }

  static final Paint _dimLayerPaint =
      Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.30);

  @override
  bool shouldRepaint(GlobePainter old) => old.render != render;
}

// --- projection / geometry helpers -------------------------------------------

/// Projects [g], clamping a back-hemisphere vertex onto the limb circle so a
/// straddling polygon renders a sensible silhouette (the disc clip trims the
/// rest) instead of folding across the globe.
Offset _projectClamped(
  GeoPoint g,
  GlobeOrientation orient,
  double radius,
  Offset center,
) {
  final p = project(g, orient, radius, center);
  if (p.front) return p.screen;
  final d = p.screen - center;
  final len = d.distance;
  if (len < 1e-6) return p.screen;
  return center + d * (radius / len);
}

const double _deg2rad = math.pi / 180.0;
const double _rad2deg = 180.0 / math.pi;

/// Unit world vector for a geo point, matching `sphere_math`'s convention
/// (+z = north pole, +x at lon 0 / lat 0).
List<double> _worldVec(GeoPoint g) {
  final lon = _deg2rad * g.lon;
  final lat = _deg2rad * g.lat;
  final cl = math.cos(lat);
  return [cl * math.cos(lon), cl * math.sin(lon), math.sin(lat)];
}

GeoPoint _geoFromVec(List<double> v) {
  final len = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  final z = (v[2] / len).clamp(-1.0, 1.0);
  return GeoPoint(math.atan2(v[1], v[0]) * _rad2deg, math.asin(z) * _rad2deg);
}

/// Interior point of a ring: the normalized mean of its vertex vectors.
GeoPoint _centroid(List<GeoPoint> ring) {
  var x = 0.0, y = 0.0, z = 0.0;
  for (final g in ring) {
    final v = _worldVec(g);
    x += v[0];
    y += v[1];
    z += v[2];
  }
  if (x == 0 && y == 0 && z == 0) return ring.isEmpty ? const GeoPoint(0, 0) : ring.first;
  return _geoFromVec([x, y, z]);
}

/// A drawable boundary ring for a spherical cap: a circle of angular radius
/// [radiusDeg] around [center], sampled into [_kCapSegments] great-circle points
/// (correct even when the cap covers a pole).
List<GeoPoint> _capBoundary(GeoPoint center, double radiusDeg) {
  final c = _worldVec(center);
  // Tangent basis (u, v) perpendicular to c.
  var u = _cross(c, const [0, 0, 1]);
  if (_norm(u) < 1e-6) u = _cross(c, const [1, 0, 0]);
  u = _normalize(u);
  final v = _normalize(_cross(c, u));
  final r = radiusDeg * _deg2rad;
  final cr = math.cos(r), sr = math.sin(r);
  final out = <GeoPoint>[];
  for (var i = 0; i < _kCapSegments; i++) {
    final t = 2 * math.pi * i / _kCapSegments;
    final ct = math.cos(t), st = math.sin(t);
    out.add(_geoFromVec([
      c[0] * cr + (u[0] * ct + v[0] * st) * sr,
      c[1] * cr + (u[1] * ct + v[1] * st) * sr,
      c[2] * cr + (u[2] * ct + v[2] * st) * sr,
    ]));
  }
  return out;
}

List<double> _cross(List<double> a, List<double> b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];

double _norm(List<double> a) =>
    math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);

List<double> _normalize(List<double> a) {
  final n = _norm(a);
  if (n < 1e-12) return a;
  return [a[0] / n, a[1] / n, a[2] / n];
}
