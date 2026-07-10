import 'dart:ui' show Color, Offset;

import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/design_system/colors.dart';
import 'package:underdeck_app/design_system/typography.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/maps_domain.dart';

void main() {
  group('enum must-ignore parsing', () {
    test('MapType parses known and falls back to unknown', () {
      expect(MapType.fromWire('flat'), MapType.flat);
      expect(MapType.fromWire('sphere'), MapType.sphere);
      expect(MapType.fromWire('hologram'), MapType.unknown);
      expect(MapType.fromWire(null), MapType.unknown);
      expect(MapType.fromWire(42), MapType.unknown);
    });

    test('MapIcon parses known and falls back to unknown', () {
      expect(MapIcon.fromWire('dungeon'), MapIcon.dungeon);
      expect(MapIcon.fromWire('sector'), MapIcon.sector);
      expect(MapIcon.fromWire('spaceship'), MapIcon.unknown);
    });

    test('ZoneFieldType maps wire "enum" to enumeration and unknowns fall back', () {
      expect(ZoneFieldType.fromWire('enum'), ZoneFieldType.enumeration);
      expect(ZoneFieldType.fromWire('longText'), ZoneFieldType.longText);
      expect(ZoneFieldType.fromWire('stringList'), ZoneFieldType.stringList);
      expect(ZoneFieldType.fromWire('color'), ZoneFieldType.unknown);
    });
  });

  group('geometry parsing', () {
    test('polygon with a hole ring', () {
      final g = ZoneGeometry.fromJson({
        'kind': 'polygon',
        'rings': [
          [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
          [
            [2, 2],
            [3, 2],
            [3, 3],
          ],
        ],
      });
      expect(g, isA<PolygonGeometry>());
      final p = g as PolygonGeometry;
      expect(p.rings.length, 2);
      expect(p.rings[0][1], const Offset(10, 0));
      expect(p.vertexCount, 6);
    });

    test('marker keeps zoom-independent hit radius', () {
      final g = ZoneGeometry.fromJson({
        'kind': 'marker',
        'at': [2540, 3300],
        'hitRadius': 48,
      });
      expect(g, isA<MarkerGeometry>());
      final m = g as MarkerGeometry;
      expect(m.at, const Offset(2540, 3300));
      expect(m.hitRadius, 48.0);
      expect(m.vertexCount, 1);
    });

    test('sphericalPolygon parses lon/lat rings', () {
      final g = ZoneGeometry.fromJson({
        'kind': 'sphericalPolygon',
        'rings': [
          [
            [-12.0, 8.0],
            [-10.1, 8.0],
            [-8.2, 8.1],
          ],
        ],
      });
      final sp = g as SphericalPolygonGeometry;
      expect(sp.rings[0].first, const GeoPoint(-12.0, 8.0));
      expect(sp.vertexCount, 3);
    });

    test('sphericalCap parses center + radius', () {
      final g = ZoneGeometry.fromJson({
        'kind': 'sphericalCap',
        'center': [0.0, 90.0],
        'radiusDeg': 18.0,
      });
      final cap = g as SphericalCapGeometry;
      expect(cap.center, const GeoPoint(0.0, 90.0));
      expect(cap.radiusDeg, 18.0);
      expect(cap.vertexCount, 1);
    });

    test('unknown geometry kind becomes UnknownGeometry (never throws)', () {
      final g = ZoneGeometry.fromJson({'kind': 'voxel', 'blob': 1});
      expect(g, isA<UnknownGeometry>());
      expect(g.vertexCount, 0);
    });
  });

  group('MapTheme', () {
    test('parses #RRGGBB and #AARRGGBB', () {
      final t = MapTheme.fromJson({
        'background': '#0A0612',
        'accent': '#80FFB347',
      });
      expect(t.background, const Color(0xFF0A0612));
      expect(t.accent, const Color(0x80FFB347));
    });

    test('bad color falls back per-token to the AppColors default', () {
      final t = MapTheme.fromJson({
        'background': 'not-a-color',
        'zoneStroke': '#ZZZZZZ',
        'label': 12345,
      });
      expect(t.background, MapTheme.defaults.background);
      expect(t.background, AppColors.bgDeepest);
      expect(t.zoneStroke, MapTheme.defaults.zoneStroke);
      expect(t.label, MapTheme.defaults.label);
    });

    test('fontFamily whitelist enforced, else default', () {
      expect(MapTheme.fromJson({'fontFamily': 'JetBrainsMono'}).fontFamily,
          AppTypography.fontMono);
      expect(MapTheme.fromJson({'fontFamily': 'Comic Sans'}).fontFamily,
          MapTheme.defaults.fontFamily);
    });

    test('null/empty json yields all defaults', () {
      final t = MapTheme.fromJson(null);
      expect(t.background, MapTheme.defaults.background);
      expect(t.fontFamily, MapTheme.defaults.fontFamily);
    });

    test('override replaces only present tokens', () {
      final base = MapTheme.defaults;
      final o = MapThemeOverride.fromJson({'zoneFill': '#112233'});
      final merged = base.withOverride(o);
      expect(merged.zoneFill, const Color(0xFF112233));
      expect(merged.background, base.background);
    });
  });

  group('ZoneFieldSpec filterable rule', () {
    test('filterable honoured for enumeration', () {
      final f = ZoneFieldSpec.fromJson({
        'key': 'threat',
        'label': 'Threat',
        'type': 'enum',
        'options': ['low', 'high'],
        'filterable': true,
      });
      expect(f.type, ZoneFieldType.enumeration);
      expect(f.filterable, isTrue);
    });

    test('filterable dropped for a non-enum type', () {
      final f = ZoneFieldSpec.fromJson({
        'key': 'boss',
        'label': 'Boss',
        'type': 'text',
        'filterable': true,
      });
      expect(f.type, ZoneFieldType.text);
      expect(f.filterable, isFalse);
    });
  });

  group('MapDocument parsing', () {
    test('parses the full flat example including zones and labelAnchor', () {
      final doc = MapDocument.fromJson({
        'schemaVersion': 1,
        'id': 'hideous-dungeon',
        'type': 'flat',
        'canvas': {'width': 3072, 'height': 4096},
        'theme': {'background': '#0A0612', 'fontFamily': 'JetBrainsMono'},
        'fieldsSchema': [
          {
            'key': 'threat',
            'label': 'Threat',
            'type': 'enum',
            'options': ['low', 'high'],
            'filterable': true,
          },
        ],
        'zones': [
          {
            'id': 'z-entry',
            'name': 'Hall of Chains',
            'geometry': {
              'kind': 'polygon',
              'rings': [
                [
                  [210, 388],
                  [842, 361],
                  [901, 918],
                ],
              ],
            },
            'labelAnchor': [520, 660],
            'fields': {'threat': 'low'},
          },
        ],
      });
      expect(doc.type, MapType.flat);
      expect(doc.canvas!.width, 3072);
      expect(doc.fieldsSchema.single.filterable, isTrue);
      final zone = doc.zones.single;
      expect(zone.labelAnchor, const Offset(520, 660));
      expect(zone.geometry, isA<PolygonGeometry>());
      expect(zone.fields['threat'], 'low');
    });

    test('unknown map type is retained (must-ignore), not rejected', () {
      final doc = MapDocument.fromJson({
        'schemaVersion': 9,
        'id': 'mystery',
        'type': 'wormhole',
        'zones': [],
      });
      expect(doc.type, MapType.unknown);
      expect(doc.theme.background, MapTheme.defaults.background);
    });
  });
}
