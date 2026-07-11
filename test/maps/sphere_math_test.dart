import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_geometry.dart';
import 'package:underdeck_app/features/knowledge/maps/render/sphere_math.dart';

// Tolerances: the transforms are closed-form doubles, so round-trips are tight.
const double _tol = 1e-6;

void expectGeoClose(GeoPoint a, GeoPoint b, {double tol = _tol}) {
  expect(a.lat, closeTo(b.lat, tol), reason: 'lat: $a vs $b');
  // Longitude is meaningless at the poles and wraps at ±180.
  if (a.lat.abs() < 90 - 1e-3) {
    var dLon = (a.lon - b.lon).abs() % 360;
    if (dLon > 180) dLon = 360 - dLon;
    expect(dLon, closeTo(0, tol), reason: 'lon: $a vs $b');
  }
}

void main() {
  const radius = 100.0;
  const center = Offset(200, 200);

  group('project', () {
    test('centres the look-at point and puts north up', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      final centreP = project(const GeoPoint(0, 0), o, radius, center);
      expect(centreP.front, isTrue);
      expect(centreP.screen.dx, closeTo(center.dx, _tol));
      expect(centreP.screen.dy, closeTo(center.dy, _tol));

      // The north pole projects straight up (smaller screen-y).
      final northP = project(const GeoPoint(0, 90), o, radius, center);
      expect(northP.front, isTrue);
      expect(northP.screen.dx, closeTo(center.dx, _tol));
      expect(northP.screen.dy, closeTo(center.dy - radius, _tol));
    });

    test('a back-hemisphere point is not flagged front', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      // Antipode of the look-at point is on the far side.
      final back = project(const GeoPoint(180, 0), o, radius, center);
      expect(back.front, isFalse);

      // A point just past 90° of longitude is also on the back.
      final farSide = project(const GeoPoint(120, 0), o, radius, center);
      expect(farSide.front, isFalse);
    });
  });

  group('forward/inverse round-trip', () {
    test('front points survive project → unproject', () {
      final o = GlobeOrientation.fromLatLon(lat: 15, lon: -40, rollDeg: 12);
      const samples = [
        GeoPoint(-40, 15), // the look-at point itself
        GeoPoint(-30, 25),
        GeoPoint(-55, 5),
        GeoPoint(-45, -10),
        GeoPoint(-40, 60),
      ];
      for (final g in samples) {
        final p = project(g, o, radius, center);
        expect(p.front, isTrue, reason: '$g should be front');
        final back = unproject(p.screen, o, radius, center);
        expect(back, isNotNull, reason: '$g should unproject');
        expectGeoClose(back!, g);
      }
    });

    test('unproject at the exact centre returns the look-at point', () {
      final o = GlobeOrientation.fromLatLon(lat: 33, lon: 77);
      final g = unproject(center, o, radius, center);
      expect(g, isNotNull);
      expectGeoClose(g!, const GeoPoint(77, 33));
    });
  });

  group('unproject limb / miss rejection', () {
    final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);

    test('a tap past 0.95R is rejected (ill-conditioned limb)', () {
      // 0.96R from centre.
      final tap = Offset(center.dx + 0.96 * radius, center.dy);
      expect(unproject(tap, o, radius, center), isNull);
    });

    test('a tap just inside 0.95R is accepted', () {
      final tap = Offset(center.dx + 0.94 * radius, center.dy);
      expect(unproject(tap, o, radius, center), isNotNull);
    });

    test('a tap outside the disc is rejected', () {
      final tap = Offset(center.dx + 1.5 * radius, center.dy);
      expect(unproject(tap, o, radius, center), isNull);
    });
  });

  group('orientation helpers', () {
    test('dragBy moves the look-at longitude and round-trips', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      // Drag a quarter-turn worth of pixels rightward: the surface is pulled
      // right, so what was one quarter-turn to the WEST (lon −90) now faces
      // the camera (grab-the-surface, like Google Earth).
      final dragged = o.dragBy(radius * math.pi / 2, 0, radius);
      final centreGeo = unproject(center, dragged, radius, center);
      expect(centreGeo, isNotNull);
      // Still on the equator, longitude has shifted by 90° westward.
      expect(centreGeo!.lat, closeTo(0, 1e-6));
      expect(centreGeo.lon, closeTo(-90, 1e-6));
    });

    test('dragBy with positive dx pulls the surface toward +x (right)', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      // The point at screen centre before the drag…
      final dragged = o.dragBy(25, 0, radius);
      // …must move rightward (toward +x) after a rightward drag.
      final p = project(const GeoPoint(0, 0), dragged, radius, center);
      expect(p.front, isTrue);
      expect(p.screen.dx, greaterThan(center.dx + 1));
      expect(p.screen.dy, closeTo(center.dy, 1e-6));
    });

    test('dragBy with positive dy pulls the surface toward +y (down)', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      final dragged = o.dragBy(0, 25, radius);
      final p = project(const GeoPoint(0, 0), dragged, radius, center);
      expect(p.front, isTrue);
      expect(p.screen.dy, greaterThan(center.dy + 1));
      expect(p.screen.dx, closeTo(center.dx, 1e-6));
    });

    test('autoRotate is a pure world spin about the pole', () {
      final o = GlobeOrientation.fromLatLon(lat: 0, lon: 0);
      final spun = o.autoRotate(30);
      // The north pole stays fixed on screen under a polar spin.
      final before = project(const GeoPoint(0, 90), o, radius, center);
      final after = project(const GeoPoint(0, 90), spun, radius, center);
      expect(after.screen.dx, closeTo(before.screen.dx, _tol));
      expect(after.screen.dy, closeTo(before.screen.dy, _tol));
      // The equator point that was centred is now off-centre.
      final eq = project(const GeoPoint(0, 0), spun, radius, center);
      expect((eq.screen.dx - center.dx).abs(), greaterThan(1.0));
    });

    test('autoRotate(360) returns to the same projection', () {
      final o = GlobeOrientation.fromLatLon(lat: 10, lon: 20);
      final full = o.autoRotate(360);
      final a = project(const GeoPoint(25, 5), o, radius, center);
      final b = project(const GeoPoint(25, 5), full, radius, center);
      expect(b.screen.dx, closeTo(a.screen.dx, 1e-4));
      expect(b.screen.dy, closeTo(a.screen.dy, 1e-4));
    });
  });

  group('tessellateRing', () {
    test('subdivides long edges below the max segment angle', () {
      // A single 90° equatorial edge.
      const ring = [GeoPoint(0, 0), GeoPoint(90, 0)];
      final dense = tessellateRing(ring, maxSegmentDeg: 2.0);
      // Closed ring: two 90° edges (0→90 and the 90→0 wrap), each split into
      // 45 segments → far more than the 2 input vertices.
      expect(dense.length, greaterThan(45));
      // Every consecutive pair (cyclic) is now under ~2°.
      for (var i = 0; i < dense.length; i++) {
        final a = dense[i];
        final b = dense[(i + 1) % dense.length];
        final d = _angularDistanceDeg(a, b);
        expect(d, lessThan(2.0 + 1e-6), reason: 'edge $i: $a→$b = $d°');
      }
    });

    test('leaves already-short edges untouched', () {
      const ring = [GeoPoint(0, 0), GeoPoint(1, 0), GeoPoint(1, 1)];
      final dense = tessellateRing(ring, maxSegmentDeg: 2.0);
      expect(dense.length, ring.length);
    });

    test('drops a trailing closing duplicate', () {
      const ring = [GeoPoint(0, 0), GeoPoint(0.5, 0), GeoPoint(0, 0)];
      final dense = tessellateRing(ring, maxSegmentDeg: 2.0);
      expect(dense.length, 2);
      expect(dense.first, const GeoPoint(0, 0));
    });
  });

  group('pointInSphericalPolygon', () {
    test('handles a polygon crossing the antimeridian', () {
      // A box straddling ±180 near the equator: lon 170 → -170.
      const ring = [
        GeoPoint(170, -10),
        GeoPoint(-170, -10),
        GeoPoint(-170, 10),
        GeoPoint(170, 10),
      ];
      // Point at lon 180 (dead centre of the box) is inside.
      expect(
        pointInSphericalPolygon(const GeoPoint(180, 0), [ring]),
        isTrue,
      );
      expect(
        pointInSphericalPolygon(const GeoPoint(175, 5), [ring]),
        isTrue,
      );
      expect(
        pointInSphericalPolygon(const GeoPoint(-178, -8), [ring]),
        isTrue,
      );
      // A point on the far side (lon 0) is outside.
      expect(
        pointInSphericalPolygon(const GeoPoint(0, 0), [ring]),
        isFalse,
      );
      // Just outside the latitude band.
      expect(
        pointInSphericalPolygon(const GeoPoint(180, 20), [ring]),
        isFalse,
      );
    });

    test('even-odd holes: a point in the hole is outside', () {
      // Outer 40° box around the origin, inner 10° hole around the origin.
      const outer = [
        GeoPoint(-20, -20),
        GeoPoint(20, -20),
        GeoPoint(20, 20),
        GeoPoint(-20, 20),
      ];
      const hole = [
        GeoPoint(-5, -5),
        GeoPoint(5, -5),
        GeoPoint(5, 5),
        GeoPoint(-5, 5),
      ];
      // Inside outer, inside hole → excluded.
      expect(
        pointInSphericalPolygon(const GeoPoint(0, 0), [outer, hole]),
        isFalse,
      );
      // Inside outer, outside hole (in the ring) → included.
      expect(
        pointInSphericalPolygon(const GeoPoint(12, 0), [outer, hole]),
        isTrue,
      );
      // Outside outer entirely → excluded.
      expect(
        pointInSphericalPolygon(const GeoPoint(30, 0), [outer, hole]),
        isFalse,
      );
    });

    test('winding is independent of ring orientation', () {
      const cw = [
        GeoPoint(-10, -10),
        GeoPoint(-10, 10),
        GeoPoint(10, 10),
        GeoPoint(10, -10),
      ];
      expect(pointInSphericalPolygon(const GeoPoint(0, 0), [cw]), isTrue);
      expect(pointInSphericalPolygon(const GeoPoint(40, 0), [cw]), isFalse);
    });
  });

  group('pointInSphericalCap', () {
    test('a cap around the north pole contains the pole and nearby points', () {
      const capCenter = GeoPoint(0, 85); // near the pole
      const radiusDeg = 20.0;
      // The pole itself is 5° from the centre → inside.
      expect(
        pointInSphericalCap(const GeoPoint(0, 90), capCenter, radiusDeg),
        isTrue,
      );
      // A point at any longitude but lat 80 is 5° away → inside.
      expect(
        pointInSphericalCap(const GeoPoint(160, 80), capCenter, radiusDeg),
        isTrue,
      );
      // A point at lat 60 is 25° away → outside.
      expect(
        pointInSphericalCap(const GeoPoint(0, 60), capCenter, radiusDeg),
        isFalse,
      );
    });

    test('boundary distance is inclusive', () {
      const capCenter = GeoPoint(0, 0);
      expect(
        pointInSphericalCap(const GeoPoint(10, 0), capCenter, 10.0),
        isTrue,
      );
      expect(
        pointInSphericalCap(const GeoPoint(10.0001, 0), capCenter, 10.0),
        isFalse,
      );
    });
  });
}

double _angularDistanceDeg(GeoPoint a, GeoPoint b) {
  double toRad(double d) => d * math.pi / 180.0;
  final la = toRad(a.lat), lb = toRad(b.lat);
  final dLon = toRad(a.lon - b.lon);
  final cosD =
      math.sin(la) * math.sin(lb) + math.cos(la) * math.cos(lb) * math.cos(dLon);
  return math.acos(cosD.clamp(-1.0, 1.0)) * 180.0 / math.pi;
}
