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

/// A zone name that is only the authoring placeholder for an unexplored grid
/// cell (`Zone 907`). Placeholder-named cells are not labelled on the globe —
/// 1800 identical "Zone n" labels would be pure noise.
final RegExp _kPlaceholderName = RegExp(r'^Zone\s+\d+$');

/// Whether a grid zone earns a label: it carries a theme override (an explored,
/// colored cell) OR a real (non-placeholder, non-empty) name.
bool isLabelWorthyGridZone(MapZone z) =>
    z.themeOverride != null ||
    (z.name.isNotEmpty && !_kPlaceholderName.hasMatch(z.name.trim()));

/// Precomputed, immutable render data for one globe zone. World-space rings are
/// densified **once** here; the painter only projects them per frame.
@immutable
class SphereRenderItem {
  final String zoneId;

  /// Resolved zone theme (map theme + restricted override), already sanitized.
  final MapTheme theme;

  /// Densified rings in geographic space: `[outline, hole, …]` for a spherical
  /// polygon, or a single boundary ring for a cap. Empty for a label-only grid
  /// item ([paintBody] false).
  final List<List<GeoPoint>> rings;

  /// Representative interior point, used for front-hemisphere culling and label
  /// placement.
  final GeoPoint centroid;

  /// Label glyphs, laid out once; repositioned per frame. `null` for an unnamed
  /// zone.
  final TextPainter? label;

  /// Whether the fill/stroke body is painted. `false` for a grid zone that only
  /// carries a label (unexplored cells never build rings — see
  /// [buildSphereRender]).
  final bool paintBody;

  const SphereRenderItem({
    required this.zoneId,
    required this.theme,
    required this.rings,
    required this.centroid,
    required this.label,
    this.paintBody = true,
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

  /// The document's uniform lon/lat grid, or `null` for a free-form sphere.
  final MapGrid? grid;

  /// Cell address per grid zone id (every `gridPos` zone, including the ~1750
  /// unexplored ones that build no [SphereRenderItem]) — lets the painter draw
  /// the selection highlight for any tapped cell on demand.
  final Map<String, GridPos> gridPosById;

  /// Precomputed graticule polylines (cell-boundary meridians + parallels) in
  /// geographic space. Empty for non-grid docs.
  final List<List<GeoPoint>> graticule;

  const SphereRender({
    required this.theme,
    required this.items,
    required this.labelFontSize,
    this.grid,
    this.gridPosById = const {},
    this.graticule = const [],
  });
}

/// Builds a [SphereRender] from a parsed sphere [MapDocument]. Flat / unknown
/// geometries contribute nothing (they carry empty rings and are skipped).
///
/// For a **grid** document, fill/stroke bodies are built ONLY for zones with a
/// theme override (Venus ships 1800 cells but only ~46 colored ones — densifying
/// 1800 rings would be wasted work); labels only for [isLabelWorthyGridZone]
/// zones. Every `gridPos` is still recorded so picking/selection covers all
/// cells.
///
/// Must run with a live Flutter binding (it lays out label text).
SphereRender buildSphereRender(MapDocument doc) {
  final base = doc.theme.sanitize();
  const fontSize = 26.0;

  final grid = doc.grid;
  final items = <SphereRenderItem>[];

  if (grid != null && grid.cols > 0 && grid.rows > 0) {
    final gridPosById = <String, GridPos>{};
    for (final z in doc.zones) {
      final pos = z.gridPos;
      if (pos != null) gridPosById[z.id] = pos;
      final explicitRings = _ringsFor(z.geometry);
      final theme = zoneTheme(base, z.themeOverride);
      if (explicitRings.isNotEmpty) {
        // A grid doc may still carry hand-authored spherical shapes.
        items.add(SphereRenderItem(
          zoneId: z.id,
          theme: theme,
          rings: explicitRings,
          centroid: _centroid(explicitRings.first),
          label: z.name.isEmpty ? null : _buildLabel(z.name, fontSize, theme),
        ));
        continue;
      }
      if (pos == null) continue; // not drawable (unknown/flat geometry)
      final hasBody = z.themeOverride != null;
      final labelled = isLabelWorthyGridZone(z);
      if (!hasBody && !labelled) continue; // unexplored cell: graticule only
      items.add(SphereRenderItem(
        zoneId: z.id,
        theme: theme,
        rings: hasBody
            ? [
                gridCellRing(
                  col: pos.col,
                  row: pos.row,
                  cols: grid.cols,
                  rows: grid.rows,
                ),
              ]
            : const [],
        centroid: grid.cellCenter(pos.col, pos.row),
        label: (labelled && z.name.isNotEmpty)
            ? _buildLabel(z.name, fontSize, theme)
            : null,
        paintBody: hasBody,
      ));
    }
    return SphereRender(
      theme: base,
      items: items,
      labelFontSize: fontSize,
      grid: grid,
      gridPosById: gridPosById,
      graticule: _buildGraticule(grid),
    );
  }

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
/// non-spherical (or absent) geometry, which the globe cannot draw directly.
List<List<GeoPoint>> _ringsFor(ZoneGeometry? g) {
  switch (g) {
    case SphericalPolygonGeometry():
      return [for (final r in g.rings) tessellateRing(r)];
    case SphericalCapGeometry():
      return [_capBoundary(g.center, g.radiusDeg)];
    case PolygonGeometry():
    case MarkerGeometry():
    case UnknownGeometry():
    case null:
      return const [];
  }
}

/// Sample step (degrees) along graticule polylines. Coarser than the 3° used
/// for cell rings — the graticule is a whole-globe decoration redrawn every
/// frame, and 4° is visually indistinguishable at these radii.
const double _kGraticuleStepDeg = 4.0;

/// Precomputes the grid's cell-boundary graticule: one meridian per column
/// boundary (the ±180 seam is a single line) and the `rows − 1` interior
/// parallels, each sampled every [_kGraticuleStepDeg].
List<List<GeoPoint>> _buildGraticule(MapGrid grid) {
  final lines = <List<GeoPoint>>[];
  final lonStep = 360.0 / grid.cols;
  final latStep = 180.0 / grid.rows;
  for (var c = 0; c < grid.cols; c++) {
    final lon = -180.0 + c * lonStep;
    final pts = <GeoPoint>[];
    for (var lat = -kGridPoleClampLat;
        lat < kGridPoleClampLat;
        lat += _kGraticuleStepDeg) {
      pts.add(GeoPoint(lon, lat));
    }
    pts.add(GeoPoint(lon, kGridPoleClampLat));
    lines.add(pts);
  }
  for (var r = 1; r < grid.rows; r++) {
    final lat = 90.0 - r * latStep;
    final pts = <GeoPoint>[];
    for (var lon = -180.0; lon < 180.0; lon += _kGraticuleStepDeg) {
      pts.add(GeoPoint(lon, lat));
    }
    pts.add(GeoPoint(180.0, lat)); // close the circle at the seam
    lines.add(pts);
  }
  return lines;
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

    _paintAtmosphere(canvas, center, radius, theme);
    _paintDisc(canvas, center, radius, theme);

    // TEXTURE SEAM: to render an equirectangular surface texture later, sample
    // it here into the disc (a FragmentProgram fed the inverse-orientation
    // matrix, or a CPU-warped ImageShader). The MVP intentionally ships without
    // one — see class doc. The zone/label passes below are texture-agnostic.

    final strokeWidth = (radius * 0.012).clamp(1.5, 6.0);

    // Zones are clipped to the disc so any limb overflow is trimmed cleanly.
    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: center, radius: radius)));

    _paintGraticule(canvas, orient, radius, center, theme);

    SphereRenderItem? selectedItem;
    for (final item in render.items) {
      if (item.zoneId == selectedId) {
        selectedItem = item; // drawn last, on top
        continue;
      }
      if (!item.paintBody || item.rings.isEmpty) continue; // label-only
      _paintZone(canvas, item, orient, radius, center, strokeWidth,
          selected: false, dimmed: dimmedIds.contains(item.zoneId));
    }
    if (selectedItem != null && selectedItem.paintBody) {
      // A selected zone is never dimmed — selection wins over the filter.
      _paintZone(canvas, selectedItem, orient, radius, center, strokeWidth,
          selected: true, dimmed: false);
    } else if (selectedId != null) {
      // A selected grid cell with no prebuilt body (an unexplored or
      // label-only cell): densify its implicit quad on demand — one small
      // ring, only while a selection is active.
      _paintSelectedGridCell(
          canvas, selectedId, orient, radius, center, strokeWidth);
    }

    // Limb darkening over the zones so their colors wrap around the sphere
    // instead of ending flat at the silhouette.
    _paintLimbDarkening(canvas, center, radius, theme);
    canvas.restore();

    _paintRim(canvas, center, radius, theme);

    if (radius >= _kLabelMinRadius) {
      for (final item in render.items) {
        _paintLabel(canvas, item, orient, radius, center,
            dimmed: dimmedIds.contains(item.zoneId));
      }
    }
  }

  /// Radial-shaded sphere body, lit from the upper-left: the base tint derives
  /// from `theme.zoneFill` (the planet's body color), brightened toward the
  /// light source and falling off to near-black past the terminator so the
  /// disc reads as a lit sphere rather than a flat circle.
  void _paintDisc(Canvas canvas, Offset center, double radius, MapTheme theme) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    final body = Color.lerp(theme.zoneFill, theme.surface, 0.35)!;
    final lit = Color.lerp(body, theme.glow, 0.30)!;
    final dark = Color.lerp(body, const Color(0xFF000000), 0.72)!;
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          center: _kLightAlignment,
          radius: 1.30,
          colors: [lit, body, dark],
          stops: const [0.0, 0.48, 1.0],
        ).createShader(rect),
    );
  }

  /// Screen-space direction of the (fake) light source: upper-left.
  static const Alignment _kLightAlignment = Alignment(-0.42, -0.46);

  /// Darkens the limb after zones are painted: transparent at the centre,
  /// `theme.background` at ~55 % alpha at the rim, so zone fills appear to
  /// curve away with the sphere.
  void _paintLimbDarkening(
      Canvas canvas, Offset center, double radius, MapTheme theme) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: [
            theme.background.withValues(alpha: 0.0),
            theme.background.withValues(alpha: 0.0),
            theme.background.withValues(alpha: 0.55),
          ],
          stops: const [0.0, 0.62, 1.0],
        ).createShader(rect),
    );
  }

  /// Soft outer halo just outside the disc plus a subtle rim light on the lit
  /// (upper-left) side — the atmosphere. Drawn *under* the disc so the halo
  /// only ever bleeds outward.
  void _paintAtmosphere(
      Canvas canvas, Offset center, double radius, MapTheme theme) {
    canvas.drawCircle(
      center,
      radius * 1.035,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.075
        ..color = theme.glow.withValues(alpha: 0.16)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.08),
    );
    canvas.drawCircle(
      center,
      radius * 1.012,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.028
        ..color = theme.glow.withValues(alpha: 0.22)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.035),
    );
  }

  /// Neon rim hugging the silhouette, plus the inner rim light on the lit side.
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
    // Inner rim light: a blurred arc just inside the limb, centred on the
    // light direction (upper-left), selling the illuminated edge.
    final litColor = Color.lerp(theme.glow, const Color(0xFFFFFFFF), 0.55)!;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius * 0.965),
      -math.pi * 3 / 4 - math.pi * 0.42, // centred on the upper-left
      math.pi * 0.84,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.035
        ..color = litColor.withValues(alpha: 0.18)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.05),
    );
  }

  /// Thin cell-boundary graticule for grid documents, projected per frame.
  /// Segments dipping behind the limb simply lift the pen — no clamping needed
  /// (the disc clip trims strays).
  void _paintGraticule(Canvas canvas, GlobeOrientation orient, double radius,
      Offset center, MapTheme theme) {
    if (render.graticule.isEmpty) return;
    final path = Path();
    for (final line in render.graticule) {
      var pen = false;
      for (final g in line) {
        final p = project(g, orient, radius, center);
        if (!p.front) {
          pen = false;
          continue;
        }
        if (pen) {
          path.lineTo(p.screen.dx, p.screen.dy);
        } else {
          path.moveTo(p.screen.dx, p.screen.dy);
          pen = true;
        }
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (radius * 0.0035).clamp(0.6, 1.4)
        ..color = theme.zoneStroke.withValues(alpha: 0.14),
    );
  }

  /// Highlights the selected grid cell when it has no prebuilt render body:
  /// builds the implicit quad ring on demand and paints it with the base theme
  /// (selection fill + glow), matching [_paintZone]'s look.
  void _paintSelectedGridCell(Canvas canvas, String zoneId,
      GlobeOrientation orient, double radius, Offset center, double strokeWidth) {
    final grid = render.grid;
    final pos = render.gridPosById[zoneId];
    if (grid == null || pos == null) return;
    final c = project(
        grid.cellCenter(pos.col, pos.row), orient, radius, center);
    if (!c.front) return;
    final ring = gridCellRing(
        col: pos.col, row: pos.row, cols: grid.cols, rows: grid.rows);
    final path = Path();
    var moved = false;
    for (final g in ring) {
      final o = _projectClamped(g, orient, radius, center);
      if (moved) {
        path.lineTo(o.dx, o.dy);
      } else {
        path.moveTo(o.dx, o.dy);
        moved = true;
      }
    }
    path.close();
    paintPolygonZone(canvas, path, render.theme,
        strokeWidth: strokeWidth, selected: true);
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
