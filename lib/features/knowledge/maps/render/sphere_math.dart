import 'dart:math' as math;
import 'dart:ui' show Offset;

import 'package:flutter/foundation.dart';
import 'package:vector_math/vector_math_64.dart' show Matrix3, Quaternion, Vector3;

import '../domain/map_geometry.dart' show GeoPoint;

/// Pure-Dart math kit for the orthographic globe (AUDIT-V2 §4.5 Plan A).
///
/// No 3rd-party 3D engine: this is a closed-form orthographic projection with
/// quaternion orientation and exact, offline, unit-testable picking (reconstruct
/// z, inverse-rotate, spherical winding — antimeridian included).
///
/// ## Coordinate conventions
///
/// * **World space** is a right-handed unit sphere. A [GeoPoint] `(lon, lat)`
///   in degrees maps to the unit vector
///   `(cos lat·cos lon, cos lat·sin lon, sin lat)` — the +z axis is the north
///   pole, +x points at `(lon 0, lat 0)`.
/// * A [GlobeOrientation] holds a unit [Quaternion] `q` that maps **world → view**
///   space: `view = q · world`.
/// * **View space** is what the camera sees. The camera sits on the +z view axis
///   looking toward the origin, so a point with `view.z >= 0` is on the near
///   (front) hemisphere. The screen is the view xy-plane: +x is right, +y is up.
/// * **Screen space** is canvas pixels: `screen.x` grows right, `screen.y` grows
///   *down* (so view-y is negated when projecting).
///
/// Working in vectors throughout means the antimeridian is a non-event — there is
/// no longitude wrap-around anywhere in the picking path.
@immutable
class GlobeOrientation {
  /// Unit quaternion mapping world-space unit vectors to view space.
  final Quaternion quaternion;

  GlobeOrientation(Quaternion q) : quaternion = q.normalized();

  /// Camera looking straight down the world +z axis (north pole toward viewer).
  factory GlobeOrientation.identity() =>
      GlobeOrientation(Quaternion.identity());

  /// Orientation that centres [GeoPoint]`(lon, lat)` on screen with north up,
  /// optionally rolled by [rollDeg] about the view axis (clockwise on screen).
  factory GlobeOrientation.fromLatLon({
    required double lat,
    required double lon,
    double rollDeg = 0,
  }) {
    // Desired view basis expressed in world coordinates.
    final z = _worldVec(GeoPoint(lon, lat)); // toward the camera (screen centre)
    var up = Vector3(0, 0, 1)..sub(z.scaled(z.z)); // world-north ⟂ z
    if (up.length2 < 1e-12) {
      // Centred on a pole: north is parallel to z, pick a stable fallback up.
      final lonRad = _deg2rad * lon;
      up = Vector3(-math.cos(lonRad), -math.sin(lonRad), 0);
    }
    up.normalize();
    final x = up.cross(z)..normalize(); // screen-right = up × forward
    // We want a quaternion Q with `Q.rotated(world) == view`, i.e. whose matrix
    // has the view basis as its *rows*. vector_math's `Quaternion.fromRotation`
    // yields the transpose of its argument, so we hand it the matrix whose
    // *columns* are the basis vectors (Matrix3 is column-major).
    final r = Matrix3(
      x.x, x.y, x.z, // column 0 = screen-right
      up.x, up.y, up.z, // column 1 = screen-up
      z.x, z.y, z.z, // column 2 = toward camera
    );
    final base = GlobeOrientation(Quaternion.fromRotation(r));
    if (rollDeg == 0) return base;
    // Roll about the view axis, applied after the base orientation. vector_math
    // composes as `(a*b).rotated(v) == b.rotated(a.rotated(v))`, so the base
    // goes on the left to run first.
    final roll = Quaternion.axisAngle(Vector3(0, 0, 1), _deg2rad * rollDeg);
    return GlobeOrientation(base.quaternion * roll);
  }

  /// Rotate in response to a screen drag of ([dxPixels], [dyPixels]) over a globe
  /// of the given [radius]. Horizontal drag spins about the view-up axis,
  /// vertical drag about the view-right axis; content follows the finger.
  GlobeOrientation dragBy(double dxPixels, double dyPixels, double radius) {
    if (radius <= 0) return this;
    final yaw = Quaternion.axisAngle(Vector3(0, 1, 0), dxPixels / radius);
    final pitch = Quaternion.axisAngle(Vector3(1, 0, 0), -dyPixels / radius);
    // View-space increment applied after the current orientation. Per
    // vector_math's composition rule the current orientation goes first (left).
    return GlobeOrientation(quaternion * yaw * pitch);
  }

  /// Spin the globe about its own polar axis by [deltaDeg] (used by autorotate).
  /// This is a world-space pre-rotation, so it composes on the right.
  GlobeOrientation autoRotate(double deltaDeg) {
    if (deltaDeg == 0) return this;
    final spin = Quaternion.axisAngle(Vector3(0, 0, 1), _deg2rad * deltaDeg);
    // World spin runs before the view mapping; per vector_math's rule it goes on
    // the left so it is applied first.
    return GlobeOrientation(spin * quaternion);
  }
}

/// Result of projecting a world point to the screen: its pixel [screen] position
/// and whether it lies on the near ([front]) hemisphere (back points are culled
/// by the painter and rejected by hit-testing).
typedef Projection = ({Offset screen, bool front});

/// Fraction of the radius beyond which taps are rejected: the limb of an
/// orthographic globe is ill-conditioned (a tiny pixel error swings across a huge
/// arc), so picks past 0.95R are refused (AUDIT-V2 §4.5 3D amendment).
const double kLimbPickLimit = 0.95;

/// Forward orthographic transform: project [point] through [orientation] onto a
/// globe of [radius] centred at [center]. [Projection.front] flags whether the
/// point faces the camera.
Projection project(
  GeoPoint point,
  GlobeOrientation orientation,
  double radius,
  Offset center,
) {
  final v = orientation.quaternion.rotated(_worldVec(point));
  return (
    screen: Offset(center.dx + radius * v.x, center.dy - radius * v.y),
    front: v.z >= 0,
  );
}

/// Inverse orthographic transform (picking). Returns the [GeoPoint] under a tap
/// at [tapOffset], or `null` when the tap misses the disc or lands past
/// [kLimbPickLimit] of the radius (the limb is too ill-conditioned to trust).
GeoPoint? unproject(
  Offset tapOffset,
  GlobeOrientation orientation,
  double radius,
  Offset center,
) {
  if (radius <= 0) return null;
  final x = (tapOffset.dx - center.dx) / radius;
  final y = (center.dy - tapOffset.dy) / radius; // screen-down → view-up
  final r2 = x * x + y * y;
  if (r2 > kLimbPickLimit * kLimbPickLimit) return null;
  final z = math.sqrt(1.0 - r2); // near hemisphere
  final view = Vector3(x, y, z);
  final world = orientation.quaternion.inverted().rotated(view);
  return _geoFromVec(world);
}

/// Densify a ring of [GeoPoint]s along great-circle arcs so that no edge spans
/// more than [maxSegmentDeg] of angle. The content CI pre-densifies zones; this
/// is a defensive fallback so any edge still renders as a smooth curve.
///
/// The ring is treated as implicitly closed (a trailing duplicate of the first
/// vertex is dropped) and the returned ring is likewise open — vertices only,
/// no repeated closing point.
List<GeoPoint> tessellateRing(
  List<GeoPoint> ring, {
  double maxSegmentDeg = 2.0,
}) {
  final verts = _dropClosingDuplicate(ring);
  if (verts.length < 2) return List<GeoPoint>.of(verts);
  final vecs = [for (final g in verts) _worldVec(g)];
  final maxSeg = _deg2rad * maxSegmentDeg;
  final out = <GeoPoint>[];
  for (var i = 0; i < verts.length; i++) {
    final va = vecs[i];
    final vb = vecs[(i + 1) % verts.length];
    out.add(verts[i]);
    final angle = _angleBetween(va, vb);
    if (angle > maxSeg && angle < math.pi - 1e-9) {
      final n = (angle / maxSeg).ceil();
      for (var k = 1; k < n; k++) {
        out.add(_geoFromVec(_slerp(va, vb, k / n, angle)));
      }
    }
  }
  return out;
}

/// Spherical point-in-polygon by crossing (winding) number, with even-odd hole
/// handling. [rings] is `[outline, hole, hole, …]`; a point is inside when the
/// number of ring edges crossed is odd.
///
/// The test casts the meridian arc from [point] up to the north pole and counts
/// edge crossings. The pole is a valid "outside" reference because pole-covering
/// zones are expressed as [pointInSphericalCap]s, never polygons (AUDIT-V2 §4) —
/// so a polygon never contains a pole. This is orientation-independent, gives
/// even-odd holes for free, and handles the antimeridian by unwrapping each edge
/// locally. Rings are densified first so the linear per-edge crossing test tracks
/// the great-circle arc.
bool pointInSphericalPolygon(GeoPoint point, List<List<GeoPoint>> rings) {
  var crossings = 0;
  for (final ring in rings) {
    crossings += _meridianCrossings(point, tessellateRing(ring));
  }
  return crossings.isOdd;
}

/// Whether [point] lies within the spherical cap of angular radius [radiusDeg]
/// around [center] — i.e. the great-circle (angular) distance is within radius.
/// Correct even when the cap contains a pole.
bool pointInSphericalCap(GeoPoint point, GeoPoint center, double radiusDeg) {
  final d = _angleBetween(_worldVec(point), _worldVec(center));
  return d <= _deg2rad * radiusDeg + 1e-9; // inclusive boundary (fp-tolerant)
}

// --- internals ---------------------------------------------------------------

const double _deg2rad = math.pi / 180.0;
const double _rad2deg = 180.0 / math.pi;

Vector3 _worldVec(GeoPoint g) {
  final lon = _deg2rad * g.lon;
  final lat = _deg2rad * g.lat;
  final cl = math.cos(lat);
  return Vector3(cl * math.cos(lon), cl * math.sin(lon), math.sin(lat));
}

GeoPoint _geoFromVec(Vector3 v) {
  final n = v.normalized();
  final lat = math.asin(n.z.clamp(-1.0, 1.0)) * _rad2deg;
  final lon = math.atan2(n.y, n.x) * _rad2deg;
  return GeoPoint(lon, lat);
}

double _angleBetween(Vector3 a, Vector3 b) =>
    math.acos(a.dot(b).clamp(-1.0, 1.0));

/// Great-circle interpolation between unit vectors [a] and [b] at fraction [t],
/// where [omega] is their precomputed angular separation.
Vector3 _slerp(Vector3 a, Vector3 b, double t, double omega) {
  final sinOmega = math.sin(omega);
  if (sinOmega < 1e-9) return a.clone();
  final wa = math.sin((1 - t) * omega) / sinOmega;
  final wb = math.sin(t * omega) / sinOmega;
  return (a.scaled(wa)..add(b.scaled(wb))).normalized();
}

List<GeoPoint> _dropClosingDuplicate(List<GeoPoint> ring) {
  if (ring.length >= 2 && ring.first == ring.last) {
    return ring.sublist(0, ring.length - 1);
  }
  return ring;
}

/// Count how many edges of [ring] the upward meridian arc from [q] to the north
/// pole crosses (the geographic even-odd ray cast, in lon/lat with per-edge
/// antimeridian unwrapping).
int _meridianCrossings(GeoPoint q, List<GeoPoint> ring) {
  final verts = _dropClosingDuplicate(ring);
  if (verts.length < 3) return 0;
  var count = 0;
  for (var i = 0; i < verts.length; i++) {
    if (_edgeCrossesUpwardMeridian(q, verts[i], verts[(i + 1) % verts.length])) {
      count++;
    }
  }
  return count;
}

/// Whether the vertical (increasing-latitude) ray from [q] crosses the edge
/// [a]→[b]. Longitudes are unwrapped around [a] (edges span < 180° after CI
/// densification) so the antimeridian is handled without special-casing.
bool _edgeCrossesUpwardMeridian(GeoPoint q, GeoPoint a, GeoPoint b) {
  final lonA = a.lon;
  final lonB = lonA + _wrap180(b.lon - lonA);
  final lonQ = lonA + _wrap180(q.lon - lonA);
  // Half-open longitude span test — excludes the upper endpoint so a shared
  // vertex is counted by exactly one of its two edges.
  if ((lonA > lonQ) == (lonB > lonQ)) return false;
  final t = (lonQ - lonA) / (lonB - lonA);
  final latCross = a.lat + t * (b.lat - a.lat);
  return latCross > q.lat;
}

/// Wrap [deg] into (-180, 180].
double _wrap180(double deg) => deg - 360.0 * (deg / 360.0).roundToDouble();
