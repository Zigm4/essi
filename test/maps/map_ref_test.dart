import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_ref.dart';

void main() {
  group('MapRef.tryParse', () {
    test('parses a full {mapId, zoneId} object', () {
      final ref = MapRef.tryParse({'mapId': 'stanton', 'zoneId': 'crypt'});
      expect(ref, isNotNull);
      expect(ref!.mapId, 'stanton');
      expect(ref.zoneId, 'crypt');
    });

    test('parses a mapId-only object (link to the map, no zone)', () {
      final ref = MapRef.tryParse({'mapId': 'stanton'});
      expect(ref, isNotNull);
      expect(ref!.mapId, 'stanton');
      expect(ref.zoneId, isNull);
    });

    test('trims whitespace on both fields', () {
      final ref = MapRef.tryParse({'mapId': '  stanton  ', 'zoneId': ' a '});
      expect(ref!.mapId, 'stanton');
      expect(ref.zoneId, 'a');
    });

    test('blank zoneId normalises to null', () {
      final ref = MapRef.tryParse({'mapId': 'stanton', 'zoneId': '   '});
      expect(ref!.zoneId, isNull);
    });

    test('non-string zoneId is ignored (null)', () {
      final ref = MapRef.tryParse({'mapId': 'stanton', 'zoneId': 42});
      expect(ref!.zoneId, isNull);
    });

    test('returns null for absent / non-object input', () {
      expect(MapRef.tryParse(null), isNull);
      expect(MapRef.tryParse('stanton'), isNull);
      expect(MapRef.tryParse(const ['stanton']), isNull);
      expect(MapRef.tryParse(7), isNull);
    });

    test('returns null when mapId is missing, blank, or not a string', () {
      expect(MapRef.tryParse(const <String, Object>{}), isNull);
      expect(MapRef.tryParse({'mapId': '   '}), isNull);
      expect(MapRef.tryParse({'mapId': 123}), isNull);
      expect(MapRef.tryParse({'zoneId': 'a'}), isNull);
    });
  });

  group('MapRef.toInternalLink', () {
    test('map-only ref links to the map route', () {
      expect(
        const MapRef(mapId: 'stanton').toInternalLink(),
        'underdeck://map/stanton',
      );
    });

    test('zone ref links to the map route with a zone query', () {
      expect(
        const MapRef(mapId: 'stanton', zoneId: 'crypt').toInternalLink(),
        'underdeck://map/stanton?zone=crypt',
      );
    });

    test('encodes reserved characters in ids', () {
      final link =
          const MapRef(mapId: 'a b', zoneId: 'x&y').toInternalLink();
      expect(link, 'underdeck://map/a%20b?zone=x%26y');
    });
  });

  group('MapRef equality', () {
    test('same components are equal and hash alike', () {
      const a = MapRef(mapId: 'm', zoneId: 'z');
      const b = MapRef(mapId: 'm', zoneId: 'z');
      expect(a, b);
      expect(a.hashCode, b.hashCode);
    });

    test('differing components are unequal', () {
      expect(const MapRef(mapId: 'm', zoneId: 'z'),
          isNot(const MapRef(mapId: 'm', zoneId: 'y')));
      expect(const MapRef(mapId: 'm'),
          isNot(const MapRef(mapId: 'n')));
    });
  });
}
