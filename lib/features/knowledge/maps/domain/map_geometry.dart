import 'dart:ui' show Offset;

import 'package:flutter/foundation.dart';

/// Latitude clamp (degrees) applied to the implicit geometry of grid cells so
/// pole-touching rows stay numerically robust (a vertex exactly at ±90° has an
/// undefined longitude and degenerate winding).
const double kGridPoleClampLat = 89.5;

/// A longitude/latitude pair in **degrees** (GeoJSON order: lon, lat) used by
/// the spherical geometries. Kept distinct from [Offset] (which is canvas px)
/// so the two coordinate spaces never get silently mixed.
@immutable
class GeoPoint {
  final double lon;
  final double lat;

  const GeoPoint(this.lon, this.lat);

  @override
  bool operator ==(Object other) =>
      other is GeoPoint && other.lon == lon && other.lat == lat;

  @override
  int get hashCode => Object.hash(lon, lat);

  @override
  String toString() => 'GeoPoint($lon, $lat)';
}

/// The geometry of a [MapZone]. Sealed so exhaustive `switch` in the render and
/// hit-test layers is compiler-checked.
///
/// Must-ignore parsing: an unrecognized `kind` becomes [UnknownGeometry] (the
/// zone still exists, it just can't be drawn/picked by this build). A *known*
/// kind with structurally broken coordinates throws — that is a structural
/// violation the validator turns into a typed failure.
@immutable
sealed class ZoneGeometry {
  const ZoneGeometry();

  /// Total vertex count, used by the validator's per-zone vertex bound.
  int get vertexCount;

  factory ZoneGeometry.fromJson(Map<String, dynamic> j) {
    switch (j['kind']) {
      case 'polygon':
        return PolygonGeometry(_parsePixelRings(j['rings']));
      case 'marker':
        return MarkerGeometry(
          at: _parseOffset(j['at']),
          hitRadius: _asDouble(j['hitRadius']),
        );
      case 'sphericalPolygon':
        return SphericalPolygonGeometry(_parseGeoRings(j['rings']));
      case 'sphericalCap':
        return SphericalCapGeometry(
          center: _parseGeoPoint(j['center']),
          radiusDeg: _asDouble(j['radiusDeg']),
        );
      default:
        return const UnknownGeometry();
    }
  }
}

/// A flat polygon in canvas pixel space. First ring is the outline, subsequent
/// rings are holes (even-odd fill rule).
@immutable
class PolygonGeometry extends ZoneGeometry {
  final List<List<Offset>> rings;

  const PolygonGeometry(this.rings);

  @override
  int get vertexCount => rings.fold(0, (sum, r) => sum + r.length);
}

/// A single point-of-interest marker in canvas pixel space, hit-tested by
/// distance to [hitRadius] (radius is in canvas px, independent of zoom).
@immutable
class MarkerGeometry extends ZoneGeometry {
  final Offset at;
  final double hitRadius;

  const MarkerGeometry({required this.at, required this.hitRadius});

  @override
  int get vertexCount => 1;
}

/// A polygon on the sphere. Rings are lists of [GeoPoint] (lon/lat degrees);
/// first ring is the outline, rest are holes. Edges are pre-resampled to short
/// arcs by the content CI — the app never tessellates.
@immutable
class SphericalPolygonGeometry extends ZoneGeometry {
  final List<List<GeoPoint>> rings;

  const SphericalPolygonGeometry(this.rings);

  @override
  int get vertexCount => rings.fold(0, (sum, r) => sum + r.length);
}

/// A spherical cap (circle on the sphere) around [center] with angular radius
/// [radiusDeg]. Used for pole-containing zones to avoid degenerate winding.
@immutable
class SphericalCapGeometry extends ZoneGeometry {
  final GeoPoint center;
  final double radiusDeg;

  const SphericalCapGeometry({required this.center, required this.radiusDeg});

  @override
  int get vertexCount => 1;
}

/// Geometry whose `kind` is not understood by this build. The zone is retained
/// (so it appears in "update required" surfaces) but cannot be drawn or picked.
@immutable
class UnknownGeometry extends ZoneGeometry {
  const UnknownGeometry();

  @override
  int get vertexCount => 0;
}

// --- parsing helpers (throw on structural violations) ------------------------

double _asDouble(Object? v) => (v as num).toDouble();

Offset _parseOffset(Object? raw) {
  final l = raw as List<dynamic>;
  return Offset(_asDouble(l[0]), _asDouble(l[1]));
}

GeoPoint _parseGeoPoint(Object? raw) {
  final l = raw as List<dynamic>;
  return GeoPoint(_asDouble(l[0]), _asDouble(l[1]));
}

List<List<Offset>> _parsePixelRings(Object? raw) {
  final rings = raw as List<dynamic>;
  return [
    for (final ring in rings)
      [for (final pt in ring as List<dynamic>) _parseOffset(pt)],
  ];
}

List<List<GeoPoint>> _parseGeoRings(Object? raw) {
  final rings = raw as List<dynamic>;
  return [
    for (final ring in rings)
      [for (final pt in ring as List<dynamic>) _parseGeoPoint(pt)],
  ];
}
