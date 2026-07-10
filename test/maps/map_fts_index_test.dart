import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fts_index.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/maps_domain.dart';

void main() {
  MapDocument doc(Map<String, dynamic> json) => MapDocument.fromJson(json);

  test('indexes zone name + only searchable known-type fields', () {
    final d = doc({
      'schemaVersion': 1,
      'id': 'dungeon',
      'type': 'flat',
      'canvas': {'width': 100, 'height': 100},
      'fieldsSchema': [
        {'key': 'loot', 'label': 'Loot', 'type': 'stringList', 'searchable': true},
        {'key': 'brief', 'label': 'Brief', 'type': 'longText', 'searchable': true},
        // Not searchable → excluded from fields_text.
        {'key': 'threat', 'label': 'Threat', 'type': 'enum', 'options': ['low']},
      ],
      'zones': [
        {
          'id': 'z1',
          'name': 'Hall of Chains',
          'geometry': {
            'kind': 'polygon',
            'rings': [[[0, 0], [10, 0], [10, 10]]],
          },
          'fields': {
            'loot': ['Rusted key', 'Broken seal'],
            'brief': 'Single entry point',
            'threat': 'low',
          },
        },
      ],
    });

    final rows = buildZoneFtsRows(d);
    expect(rows, hasLength(1));
    final r = rows.single;
    expect(r.zoneId, 'z1');
    expect(r.mapId, 'dungeon');
    expect(r.name, 'Hall of Chains');
    expect(r.fieldsText, contains('Rusted key'));
    expect(r.fieldsText, contains('Broken seal'));
    expect(r.fieldsText, contains('Single entry point'));
    // The non-searchable enum value is not indexed.
    expect(r.fieldsText, isNot(contains('low')));
  });

  test('a map of unknown type is excluded from the index', () {
    final d = doc({
      'schemaVersion': 1,
      'id': 'mystery',
      'type': 'hologram', // unknown -> MapType.unknown
      'zones': [
        {
          'id': 'z1',
          'name': 'Somewhere',
          'geometry': {'kind': 'marker', 'at': [1, 1], 'hitRadius': 4},
          'fields': <String, dynamic>{},
        },
      ],
    });
    expect(buildZoneFtsRows(d), isEmpty);
  });

  test('zones with no searchable values still index their name', () {
    final d = doc({
      'schemaVersion': 1,
      'id': 'm',
      'type': 'flat',
      'canvas': {'width': 10, 'height': 10},
      'fieldsSchema': const <dynamic>[],
      'zones': [
        {
          'id': 'z',
          'name': 'Nameless Void',
          'geometry': {'kind': 'marker', 'at': [1, 1], 'hitRadius': 4},
          'fields': <String, dynamic>{},
        },
      ],
    });
    final rows = buildZoneFtsRows(d);
    expect(rows.single.name, 'Nameless Void');
    expect(rows.single.fieldsText, isEmpty);
  });
}
