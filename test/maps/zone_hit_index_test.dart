import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_geometry.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/render/zone_hit_index.dart';

MapZone _zone(String id, ZoneGeometry geometry) => MapZone(
      id: id,
      name: id,
      geometry: geometry,
      labelAnchor: null,
      themeOverride: null,
      fields: const {},
    );

PolygonGeometry _square(double x, double y, double size, {List<List<Offset>>? holes}) {
  final outer = <Offset>[
    Offset(x, y),
    Offset(x + size, y),
    Offset(x + size, y + size),
    Offset(x, y + size),
  ];
  return PolygonGeometry([outer, ...?holes]);
}

void main() {
  group('ZoneHitIndex — polygons', () {
    test('hits a point inside a polygon, misses outside', () {
      final index = ZoneHitIndex.fromZones([_zone('a', _square(0, 0, 100))]);
      expect(index.hitTest(const Offset(50, 50), scale: 1), 'a');
      expect(index.hitTest(const Offset(150, 150), scale: 1), isNull);
    });

    test('polygon hit is scale-independent', () {
      final index = ZoneHitIndex.fromZones([_zone('a', _square(0, 0, 100))]);
      expect(index.hitTest(const Offset(50, 50), scale: 0.1), 'a');
      expect(index.hitTest(const Offset(50, 50), scale: 8), 'a');
    });

    test('even-odd hole: a point inside the hole misses the zone', () {
      final withHole = _square(0, 0, 100, holes: [
        [
          const Offset(40, 40),
          const Offset(60, 40),
          const Offset(60, 60),
          const Offset(40, 60),
        ],
      ]);
      final index = ZoneHitIndex.fromZones([_zone('donut', withHole)]);
      // Inside the outer ring but inside the hole -> miss.
      expect(index.hitTest(const Offset(50, 50), scale: 1), isNull);
      // Inside the outer ring, outside the hole -> hit.
      expect(index.hitTest(const Offset(10, 10), scale: 1), 'donut');
    });

    test('degenerate polygon (no area) is not hit-testable', () {
      final index = ZoneHitIndex.fromZones([
        _zone('line', const PolygonGeometry([
          [Offset(0, 0), Offset(100, 0)],
        ])),
      ]);
      expect(index.isEmpty, isTrue);
      expect(index.hitTest(const Offset(50, 0), scale: 1), isNull);
    });
  });

  group('ZoneHitIndex — markers', () {
    test('hits within the radius, misses beyond it (scale 1)', () {
      final index = ZoneHitIndex.fromZones([
        _zone('m', const MarkerGeometry(at: Offset(200, 200), hitRadius: 20)),
      ]);
      expect(index.hitTest(const Offset(205, 205), scale: 1), 'm'); // ~7 away
      expect(index.hitTest(const Offset(230, 200), scale: 1), isNull); // 30 away
    });

    test('marker tap target grows when zoomed out (radius / scale)', () {
      final index = ZoneHitIndex.fromZones([
        _zone('m', const MarkerGeometry(at: Offset(200, 200), hitRadius: 20)),
      ]);
      // 30 canvas px away: miss at scale 1 (eff 20), hit at scale 0.5 (eff 40).
      expect(index.hitTest(const Offset(230, 200), scale: 1), isNull);
      expect(index.hitTest(const Offset(230, 200), scale: 0.5), 'm');
    });
  });

  group('ZoneHitIndex — layering & unsupported geometry', () {
    test('topmost (last-drawn) overlapping zone wins', () {
      final index = ZoneHitIndex.fromZones([
        _zone('bottom', _square(0, 0, 100)),
        _zone('top', _square(50, 50, 100)),
      ]);
      // Overlap region (50..100, 50..100): the later zone wins.
      expect(index.hitTest(const Offset(75, 75), scale: 1), 'top');
      // Only the bottom zone covers this point.
      expect(index.hitTest(const Offset(10, 10), scale: 1), 'bottom');
    });

    test('spherical and unknown geometries are never hit', () {
      final index = ZoneHitIndex.fromZones([
        _zone('sphere', const SphericalCapGeometry(
          center: GeoPoint(0, 0),
          radiusDeg: 10,
        )),
        _zone('unknown', const UnknownGeometry()),
      ]);
      expect(index.isEmpty, isTrue);
      expect(index.hitTest(const Offset(0, 0), scale: 1), isNull);
    });
  });
}
