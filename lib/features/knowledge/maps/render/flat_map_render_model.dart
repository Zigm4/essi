import 'package:flutter/widgets.dart';

import '../domain/map_geometry.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import 'zone_geometry_path.dart';

/// Minimum on-screen height (screen px) at which a zone label is legible. Below
/// this the [LabelPainter] hides all labels (LOD) rather than paint an unreadable
/// smear — see [FlatMapRender.labelLodScale].
const double kMinLabelScreenPx = 12.0;

/// Visual radius of a marker glyph as a fraction of the label font size.
const double _kMarkerRadiusFactor = 0.65;

/// Precomputed, immutable layout for one zone label in **canvas pixel space**.
/// Shared by the scrim (drawn by [ZonePainter]) and the glyphs (drawn by
/// [LabelPainter]) so the halo always sits exactly behind the text.
@immutable
class ZoneLabelLayout {
  final TextPainter painter;

  /// Top-left corner at which [painter] paints (canvas space).
  final Offset topLeft;

  /// Rounded halo/scrim rect behind the text (canvas space).
  final RRect scrim;

  const ZoneLabelLayout({
    required this.painter,
    required this.topLeft,
    required this.scrim,
  });
}

/// Everything the flat-map painters and hit index need for one zone, computed
/// once from a [MapZone]. Immutable and shareable across painters.
@immutable
class ZoneRenderItem {
  final String zoneId;

  /// The zone's **resolved** theme: the map theme with this zone's (restricted)
  /// override applied. Already dark-guarded/sanitized at the map level.
  final MapTheme theme;

  /// Even-odd fill path for a polygon zone; `null` for markers / unknown.
  final Path? fillPath;

  /// Tight canvas-space bounds of the geometry (marker: a square around it).
  final Rect bounds;

  /// Center of a marker zone; `null` for polygons.
  final Offset? markerCenter;

  /// Visual radius of the marker glyph (canvas px). Meaningless for polygons.
  final double markerRadius;

  /// Precomputed label layout, or `null` when the zone has no name.
  final ZoneLabelLayout? label;

  const ZoneRenderItem({
    required this.zoneId,
    required this.theme,
    required this.fillPath,
    required this.bounds,
    required this.markerCenter,
    required this.markerRadius,
    required this.label,
  });

  bool get isMarker => markerCenter != null;
}

/// Fully precomputed render model for a flat map document. Build once (it lays
/// out every label via [TextPainter]); the painters then only re-read it.
@immutable
class FlatMapRender {
  /// The sanitized map-level theme (base for background, scrims, LOD).
  final MapTheme theme;

  /// Canvas dimensions in map pixel space.
  final Size canvasSize;

  final List<ZoneRenderItem> items;

  /// Canvas-space label font size (labels scale with the map).
  final double labelFontSize;

  /// Viewport scale below which labels are hidden (LOD). Derived so a label is
  /// only shown once it renders at least [kMinLabelScreenPx] tall on screen.
  final double labelLodScale;

  const FlatMapRender({
    required this.theme,
    required this.canvasSize,
    required this.items,
    required this.labelFontSize,
    required this.labelLodScale,
  });
}

/// Builds a [FlatMapRender] from a parsed [MapDocument].
///
/// - Applies `document.theme.sanitize()` (the render agent's contract — the
///   theme is *not* auto-sanitized at parse) and each zone's restricted override.
/// - Precomputes an even-odd [Path] per polygon and marker geometry.
/// - Lays out every label (canvas-space [TextPainter]) plus its scrim rect.
///
/// Must be called with a live Flutter binding (it lays out text). Spherical /
/// unknown geometries are carried with a `null` [ZoneRenderItem.fillPath] and no
/// marker — they contribute nothing to the flat canvas.
FlatMapRender buildFlatMapRender(MapDocument doc) {
  final base = doc.theme.sanitize();
  final canvas = doc.canvas;
  final size = canvas == null
      ? const Size(1024, 1024)
      : Size(canvas.width, canvas.height);

  final fontSize = _labelFontSize(size);
  final markerRadius = fontSize * _kMarkerRadiusFactor;

  final items = <ZoneRenderItem>[
    for (final z in doc.zones)
      _buildItem(z, zoneTheme(base, z.themeOverride), fontSize, markerRadius),
  ];

  return FlatMapRender(
    theme: base,
    canvasSize: size,
    items: items,
    labelFontSize: fontSize,
    labelLodScale: kMinLabelScreenPx / fontSize,
  );
}

ZoneRenderItem _buildItem(
  MapZone z,
  MapTheme theme,
  double fontSize,
  double markerRadius,
) {
  Path? fillPath;
  Rect bounds;
  Offset? markerCenter;

  final g = z.geometry;
  switch (g) {
    case PolygonGeometry():
      final path = polygonPath(g);
      fillPath = path;
      bounds = path.getBounds();
    case MarkerGeometry():
      markerCenter = g.at;
      bounds = Rect.fromCircle(center: g.at, radius: markerRadius);
    case SphericalPolygonGeometry():
    case SphericalCapGeometry():
    case UnknownGeometry():
      bounds = Rect.zero;
  }

  final anchor = z.labelAnchor ?? markerCenter ?? bounds.center;
  final label = z.name.isEmpty
      ? null
      : _buildLabel(z.name, anchor, fontSize, theme);

  return ZoneRenderItem(
    zoneId: z.id,
    theme: theme,
    fillPath: fillPath,
    bounds: bounds,
    markerCenter: markerCenter,
    markerRadius: markerRadius,
    label: label,
  );
}

ZoneLabelLayout _buildLabel(
  String name,
  Offset anchor,
  double fontSize,
  MapTheme theme,
) {
  final painter = TextPainter(
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

  final topLeft = anchor - Offset(painter.width / 2, painter.height / 2);
  final padX = fontSize * 0.45;
  final padY = fontSize * 0.28;
  final scrim = RRect.fromRectAndRadius(
    Rect.fromLTWH(
      topLeft.dx - padX,
      topLeft.dy - padY,
      painter.width + padX * 2,
      painter.height + padY * 2,
    ),
    Radius.circular(fontSize * 0.5),
  );

  return ZoneLabelLayout(painter: painter, topLeft: topLeft, scrim: scrim);
}

/// Canvas-space label size, scaled to the map so it reads on both a small
/// dungeon and a large world map. Clamped to a sane band.
double _labelFontSize(Size canvas) =>
    (canvas.shortestSide * 0.018).clamp(22.0, 96.0);
