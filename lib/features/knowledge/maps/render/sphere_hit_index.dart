import '../domain/map_geometry.dart';
import '../domain/map_models.dart';
import 'sphere_math.dart';

/// A single hit-testable spherical shape, precomputed once from a zone's
/// geometry. Package-private: callers build a [SphereHitIndex].
abstract class _SphereHit {
  final String zoneId;
  const _SphereHit(this.zoneId);

  /// Whether the geographic [point] (lon/lat, already recovered by
  /// [unproject]) lies inside this shape.
  bool contains(GeoPoint point);
}

class _SphericalPolygonHit extends _SphereHit {
  final List<List<GeoPoint>> rings;
  const _SphericalPolygonHit(super.zoneId, this.rings);

  @override
  bool contains(GeoPoint point) => pointInSphericalPolygon(point, rings);
}

class _SphericalCapHit extends _SphereHit {
  final GeoPoint center;
  final double radiusDeg;
  const _SphericalCapHit(super.zoneId, this.center, this.radiusDeg);

  @override
  bool contains(GeoPoint point) =>
      pointInSphericalCap(point, center, radiusDeg);
}

/// Pure, precomputed spatial index for tapping zones on a globe (AUDIT-V2 §4.5
/// Plan A). The counterpart to the flat [ZoneHitIndex].
///
/// Build it once per document; call [hitTest] with a [GeoPoint] already
/// recovered from the tap by [unproject] (which itself rejects limb taps, so the
/// ill-conditioned rim is handled *before* this index is consulted). Draw-order
/// is preserved so the topmost (last-drawn) zone wins on overlap, matching the
/// painter.
///
/// Flat ([PolygonGeometry] / [MarkerGeometry]) and [UnknownGeometry] zones are
/// not indexed and can never be hit on a globe.
class SphereHitIndex {
  final List<_SphereHit> _shapes; // draw order (index 0 = bottom-most)

  const SphereHitIndex._(this._shapes);

  factory SphereHitIndex.fromZones(List<MapZone> zones) {
    final shapes = <_SphereHit>[];
    for (final z in zones) {
      final g = z.geometry;
      // Grid zones (implicit cell quads) are picked analytically by the
      // viewport — never through this index.
      if (g == null) continue;
      switch (g) {
        case SphericalPolygonGeometry():
          if (g.rings.isEmpty || g.rings.first.length < 3) continue;
          shapes.add(_SphericalPolygonHit(z.id, g.rings));
        case SphericalCapGeometry():
          if (g.radiusDeg <= 0) continue;
          shapes.add(_SphericalCapHit(z.id, g.center, g.radiusDeg));
        case PolygonGeometry():
        case MarkerGeometry():
        case UnknownGeometry():
          break; // not hit-testable on a globe
      }
    }
    return SphereHitIndex._(shapes);
  }

  bool get isEmpty => _shapes.isEmpty;

  /// Returns the id of the topmost zone containing [point], or `null`. [point]
  /// is `null` for a rejected tap (off-disc or past the limb) — pass it through
  /// and this returns `null`.
  String? hitTest(GeoPoint? point) {
    if (point == null) return null;
    for (var i = _shapes.length - 1; i >= 0; i--) {
      if (_shapes[i].contains(point)) return _shapes[i].zoneId;
    }
    return null;
  }
}
