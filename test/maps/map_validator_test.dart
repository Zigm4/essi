import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/maps_domain.dart';

const _validator = MapContentValidator();

Map<String, dynamic> _fileRef({int bytes = 1000}) => {
      'path': 'maps/x/map.json',
      'sha256': 'a' * 64,
      'bytes': bytes,
    };

Map<String, dynamic> _asset({
  int bytes = 1024,
  List<int> pixelSize = const [1024, 1024],
}) =>
    {
      'kind': 'background',
      'path': 'maps/x/bg.png',
      'sha256': 'b' * 64,
      'bytes': bytes,
      'pixelSize': pixelSize,
    };

Map<String, dynamic> _descriptor({
  String id = 'x',
  List<Map<String, dynamic>> assets = const [],
}) =>
    {
      'id': id,
      'type': 'flat',
      'title': 'Title',
      'icon': 'map',
      'order': 0,
      'version': 1,
      'draft': false,
      'document': _fileRef(),
      'assets': assets,
    };

Map<String, dynamic> _manifest({List<Map<String, dynamic>>? maps}) => {
      'schemaVersion': 1,
      'contentVersion': '1.0.0',
      'minAppVersion': '0.3.0',
      'cdnBase': 'https://cdn.jsdelivr.net/gh/o/c@t',
      'maps': maps ?? [_descriptor()],
    };

Map<String, dynamic> _document({
  List<Map<String, dynamic>> zones = const [],
  List<Map<String, dynamic>> fields = const [],
}) =>
    {
      'schemaVersion': 1,
      'id': 'x',
      'type': 'flat',
      'canvas': {'width': 100, 'height': 100},
      'theme': const <String, dynamic>{},
      'fieldsSchema': fields,
      'zones': zones,
    };

Map<String, dynamic> _polyZone(String id, int vertices) => {
      'id': id,
      'name': 'z',
      'geometry': {
        'kind': 'polygon',
        'rings': [
          [for (var i = 0; i < vertices; i++) [i, i]],
        ],
      },
      'fields': const <String, dynamic>{},
    };

void main() {
  group('happy path', () {
    test('valid manifest parses', () {
      final r = _validator.validateManifest(_manifest(), byteLength: 500);
      expect(r, isA<MapParseOk<MapsManifest>>());
      expect(r.valueOrNull!.maps.single.id, 'x');
    });

    test('valid document parses', () {
      final r = _validator.validateDocument(
        _document(zones: [_polyZone('z1', 5)]),
        byteLength: 500,
      );
      expect(r.isOk, isTrue);
      expect(r.valueOrNull!.zones.single.geometry!.vertexCount, 5);
    });

    test('valid pointer parses', () {
      final r = _validator.validatePointer({
        'schemaVersion': 1,
        'contentVersion': '1.4.0',
        'tag': 'maps-v1.4.0',
        'minAppVersion': '0.3.0',
        'manifest': _fileRef(bytes: 31248),
      }, byteLength: 400);
      expect(r.isOk, isTrue);
    });
  });

  group('size bounds', () {
    test('manifest over 256 KB rejected', () {
      final r = _validator.validateManifest(_manifest(),
          byteLength: 256 * 1024 + 1);
      expect((r as MapParseError).code, MapValidationCode.tooLarge);
    });

    test('document over 2 MB rejected', () {
      final r = _validator.validateDocument(_document(),
          byteLength: 2 * 1024 * 1024 + 1);
      expect((r as MapParseError).code, MapValidationCode.tooLarge);
    });
  });

  group('count bounds', () {
    test('61 maps rejected', () {
      final maps = [for (var i = 0; i < 61; i++) _descriptor(id: 'm$i')];
      final r = _validator.validateManifest(_manifest(maps: maps),
          byteLength: 1000);
      expect((r as MapParseError).code, MapValidationCode.tooManyMaps);
    });

    test('501 zones rejected', () {
      final zones = [for (var i = 0; i < 501; i++) _polyZone('z$i', 3)];
      final r = _validator.validateDocument(_document(zones: zones),
          byteLength: 1000);
      expect((r as MapParseError).code, MapValidationCode.tooManyZones);
    });

    test('5001 vertices in a zone rejected', () {
      final r = _validator.validateDocument(
        _document(zones: [_polyZone('big', 5001)]),
        byteLength: 1000,
      );
      expect((r as MapParseError).code, MapValidationCode.tooManyVertices);
    });

    test('26 fieldsSchema rejected', () {
      final fields = [
        for (var i = 0; i < 26; i++)
          {'key': 'k$i', 'label': 'L', 'type': 'text'},
      ];
      final r = _validator.validateDocument(_document(fields: fields),
          byteLength: 1000);
      expect((r as MapParseError).code, MapValidationCode.tooManyFields);
    });

    test('20 enum options accepted (a real map needs a 17-option region enum)',
        () {
      final fields = [
        {
          'key': 'k',
          'label': 'L',
          'type': 'enum',
          'options': [for (var i = 0; i < 20; i++) 'o$i'],
        },
      ];
      final r = _validator.validateDocument(_document(fields: fields),
          byteLength: 1000);
      expect(r.isOk, isTrue);
    });

    test('over 20 enum options rejected', () {
      final fields = [
        {
          'key': 'k',
          'label': 'L',
          'type': 'enum',
          'options': [for (var i = 0; i < 21; i++) 'o$i'],
        },
      ];
      final r = _validator.validateDocument(_document(fields: fields),
          byteLength: 1000);
      expect((r as MapParseError).code, MapValidationCode.tooManyOptions);
    });
  });

  group('image bounds', () {
    test('asset over 8 MB rejected', () {
      final r = _validator.validateManifest(
        _manifest(maps: [
          _descriptor(assets: [_asset(bytes: 8 * 1024 * 1024 + 1)]),
        ]),
        byteLength: 1000,
      );
      expect((r as MapParseError).code, MapValidationCode.imageTooLarge);
    });

    test('asset over 4096px rejected', () {
      final r = _validator.validateManifest(
        _manifest(maps: [
          _descriptor(assets: [_asset(pixelSize: [4097, 100])]),
        ]),
        byteLength: 1000,
      );
      expect(
          (r as MapParseError).code, MapValidationCode.imageDimensionsTooLarge);
    });

    test('asset at exactly 4096px is accepted', () {
      final r = _validator.validateManifest(
        _manifest(maps: [
          _descriptor(assets: [_asset(pixelSize: [4096, 4096])]),
        ]),
        byteLength: 1000,
      );
      expect(r.isOk, isTrue);
    });

    test('rendered image asset missing pixelSize is rejected', () {
      for (final kind in const ['background', 'background_hd', 'texture']) {
        final asset = _asset()..remove('pixelSize');
        asset['kind'] = kind;
        final r = _validator.validateManifest(
          _manifest(maps: [_descriptor(assets: [asset])]),
          byteLength: 1000,
        );
        expect((r as MapParseError).code,
            MapValidationCode.imageDimensionsMissing,
            reason: 'kind=$kind must require pixelSize');
      }
    });

    test('thumbnail (and other roles) may omit pixelSize', () {
      final thumb = _asset()..remove('pixelSize');
      thumb['kind'] = 'thumbnail';
      final r = _validator.validateManifest(
        _manifest(maps: [_descriptor(assets: [thumb])]),
        byteLength: 1000,
      );
      expect(r.isOk, isTrue);
    });
  });

  group('string caps', () {
    test('over-long map id rejected', () {
      final r = _validator.validateManifest(
        _manifest(maps: [_descriptor(id: 'z' * 65)]),
        byteLength: 1000,
      );
      expect((r as MapParseError).code, MapValidationCode.stringTooLong);
    });
  });

  group('structural violations (never throw raw)', () {
    test('missing required field -> malformedStructure', () {
      final bad = _manifest();
      (bad['maps'] as List).first.remove('id');
      final r = _validator.validateManifest(bad, byteLength: 500);
      expect((r as MapParseError).code, MapValidationCode.malformedStructure);
    });

    test('wrong JSON type -> malformedStructure', () {
      final bad = _document();
      bad['zones'] = 'not-a-list';
      final r = _validator.validateDocument(bad, byteLength: 500);
      expect((r as MapParseError).code, MapValidationCode.malformedStructure);
    });

    test('non-positive canvas -> invalidBounds', () {
      final bad = _document();
      bad['canvas'] = {'width': 0, 'height': 100};
      final r = _validator.validateDocument(bad, byteLength: 500);
      expect((r as MapParseError).code, MapValidationCode.invalidBounds);
    });
  });

  group('must-ignore survives validation', () {
    test('unknown map type is accepted, not rejected', () {
      final doc = _document();
      doc['type'] = 'wormhole';
      final r = _validator.validateDocument(doc, byteLength: 500);
      expect(r.isOk, isTrue);
      expect(r.valueOrNull!.type, MapType.unknown);
    });

    test('unknown geometry kind is accepted', () {
      final doc = _document(zones: [
        {
          'id': 'z',
          'name': 'z',
          'geometry': {'kind': 'voxel'},
          'fields': const <String, dynamic>{},
        },
      ]);
      final r = _validator.validateDocument(doc, byteLength: 500);
      expect(r.isOk, isTrue);
      expect(r.valueOrNull!.zones.single.geometry, isA<UnknownGeometry>());
    });
  });
}
