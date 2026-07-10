import '../domain/map_enums.dart';
import '../domain/map_models.dart';

/// One FTS5 row for a zone: the searchable projection of a [MapZone] used to
/// populate `map_zone_fts`.
class ZoneFtsRow {
  final String zoneId;
  final String mapId;
  final String name;

  /// Space-joined text of the zone's *searchable* field values (per the map's
  /// `fieldsSchema`).
  final String fieldsText;

  const ZoneFtsRow({
    required this.zoneId,
    required this.mapId,
    required this.name,
    required this.fieldsText,
  });

  @override
  String toString() =>
      'ZoneFtsRow($mapId/$zoneId, "$name", "$fieldsText")';
}

/// Projects a parsed [doc] into the FTS rows to index.
///
/// Rules (AUDIT-V2 §4.7):
/// - a map of *unknown* type OR a schema newer than this build understands is
///   excluded entirely (it renders as "update required" and must not lead search
///   to a dead end);
/// - only fields whose schema entry is `searchable` AND of a known type
///   contribute to `fields_text`;
/// - the zone `name` is always indexed.
List<ZoneFtsRow> buildZoneFtsRows(MapDocument doc) {
  if (doc.type == MapType.unknown ||
      doc.schemaVersion > kSupportedMapSchemaVersion) {
    return const [];
  }

  final searchableKeys = <String>{
    for (final f in doc.fieldsSchema)
      if (f.searchable && f.type != ZoneFieldType.unknown) f.key,
  };

  final rows = <ZoneFtsRow>[];
  for (final z in doc.zones) {
    final parts = <String>[];
    for (final key in searchableKeys) {
      final text = _stringifyFieldValue(z.fields[key]);
      if (text.isNotEmpty) parts.add(text);
    }
    rows.add(
      ZoneFtsRow(
        zoneId: z.id,
        mapId: doc.id,
        name: z.name,
        fieldsText: parts.join(' '),
      ),
    );
  }
  return rows;
}

/// Flattens a schema-driven field value into searchable text. Strings pass
/// through; lists are joined; numbers/bools are stringified; null/maps yield
/// empty (maps are not a v1 field type).
String _stringifyFieldValue(Object? value) {
  if (value == null) return '';
  if (value is String) return value;
  if (value is num || value is bool) return value.toString();
  if (value is List) {
    return value.map(_stringifyFieldValue).where((s) => s.isNotEmpty).join(' ');
  }
  return '';
}
