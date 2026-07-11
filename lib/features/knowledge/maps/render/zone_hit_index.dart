import 'dart:ui';

import '../domain/map_geometry.dart';
import '../domain/map_models.dart';
import 'zone_geometry_path.dart';

/// A single hit-testable shape, precomputed once from a zone's geometry. Kept
/// package-private: callers build a [ZoneHitIndex], they never touch shapes.
abstract class _HitShape {
  final String zoneId;
  const _HitShape(this.zoneId);

  /// Whether [p] (a point in **canvas pixel space**) hits this shape at the
  /// current [scale] (canvas-px → screen-px factor of the viewport transform).
  bool contains(Offset p, double scale);
}

class _PolygonHit extends _HitShape {
  final Path path;
  final Rect bounds;
  _PolygonHit(super.zoneId, this.path) : bounds = path.getBounds();

  @override
  bool contains(Offset p, double scale) =>
      bounds.contains(p) && path.contains(p);
}

class _MarkerHit extends _HitShape {
  final Offset at;
  final double hitRadius;
  const _MarkerHit(super.zoneId, this.at, this.hitRadius);

  @override
  bool contains(Offset p, double scale) {
    // [hitRadius] is a constant *screen*-space tap tolerance; dividing by the
    // viewport scale converts it into the canvas-space radius that keeps the
    // marker's tap target the same physical size at every zoom level.
    final effective = scale <= 0 ? hitRadius : hitRadius / scale;
    return (p - at).distanceSquared <= effective * effective;
  }
}

/// Pure, precomputed spatial index for tapping zones on a flat map.
///
/// Build it once per document; call [hitTest] with a point already inverted
/// into canvas pixel space (invert the [InteractiveViewer] matrix at the tap
/// site). Draw-order is preserved so the **topmost** (last-drawn) zone wins when
/// shapes overlap — matching what the user sees on screen.
///
/// - Polygons hit-test via [Path.contains] with an even-odd fill rule, so a tap
///   inside a hole correctly misses the zone.
/// - Markers hit-test by distance to a scale-compensated radius.
/// - Zones with [UnknownGeometry] (or spherical geometry, on a flat map) are not
///   indexed and can never be hit.
class ZoneHitIndex {
  final List<_HitShape> _shapes; // in draw order (index 0 = bottom-most)

  const ZoneHitIndex._(this._shapes);

  /// Precomputes an index from [zones] in their draw order.
  factory ZoneHitIndex.fromZones(List<MapZone> zones) {
    final shapes = <_HitShape>[];
    for (final z in zones) {
      final g = z.geometry;
      if (g == null) continue; // grid zones are never hit on a flat map
      switch (g) {
        case PolygonGeometry():
          final path = polygonPath(g);
          // Skip degenerate polygons (no enclosed area) so they can't swallow
          // taps meant for a zone beneath them.
          if (path.getBounds().isEmpty) continue;
          shapes.add(_PolygonHit(z.id, path));
        case MarkerGeometry():
          shapes.add(_MarkerHit(z.id, g.at, g.hitRadius));
        case SphericalPolygonGeometry():
        case SphericalCapGeometry():
        case UnknownGeometry():
          break; // not hit-testable on a flat map
      }
    }
    return ZoneHitIndex._(shapes);
  }

  /// Whether any zone is indexed (an all-unknown map yields an empty index).
  bool get isEmpty => _shapes.isEmpty;

  /// Returns the id of the topmost zone containing [canvasPoint], or `null`.
  ///
  /// [scale] is the viewport's canvas-px → screen-px factor, used only to size
  /// marker tap targets; polygon hits are scale-independent.
  String? hitTest(Offset canvasPoint, {required double scale}) {
    for (var i = _shapes.length - 1; i >= 0; i--) {
      if (_shapes[i].contains(canvasPoint, scale)) return _shapes[i].zoneId;
    }
    return null;
  }
}
