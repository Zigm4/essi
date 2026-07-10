/// Closed enums for the dynamic-maps content schema.
///
/// Parsing is deliberately **must-ignore**: any unrecognized wire value maps to
/// the enum's `unknown` member instead of throwing. That way a content file
/// authored against a *future* schema (new map type, new field type, new icon)
/// still parses on an older build — the offending map/zone/field is surfaced as
/// "update required" rather than crashing the whole pipeline. Only structural or
/// bounds violations (handled by [MapContentValidator]) reject a file.
library;

/// The highest map-document `schemaVersion` this app build understands. A
/// document declaring a higher schema is rendered as "update required" (not
/// openable, excluded from search) rather than mis-rendered — the same posture
/// as an unknown [MapType], but keyed on the schema integer so a *future* additive
/// bump that this build can't interpret is caught even when the type is known
/// (AUDIT-V2 §4.7). Bump this when the app gains support for a new schema.
const int kSupportedMapSchemaVersion = 1;

/// How a map is rendered. `flat` = 2D image-space, `sphere` = orthographic globe.
enum MapType {
  flat,
  sphere,
  unknown;

  /// Must-ignore parse: unknown wire strings become [MapType.unknown].
  static MapType fromWire(Object? raw) {
    switch (raw) {
      case 'flat':
        return MapType.flat;
      case 'sphere':
        return MapType.sphere;
      default:
        return MapType.unknown;
    }
  }
}

/// Icon shown for a map in the gallery. Closed set drawn by the render layer;
/// unknown values fall back to a generic glyph.
enum MapIcon {
  map,
  dungeon,
  station,
  sphere,
  sector,
  unknown;

  static MapIcon fromWire(Object? raw) {
    switch (raw) {
      case 'map':
        return MapIcon.map;
      case 'dungeon':
        return MapIcon.dungeon;
      case 'station':
        return MapIcon.station;
      case 'sphere':
        return MapIcon.sphere;
      case 'sector':
        return MapIcon.sector;
      default:
        return MapIcon.unknown;
    }
  }
}

/// The type of a schema-driven zone field. Note the wire name for
/// [ZoneFieldType.enumeration] is `"enum"` (Dart reserves `enum`).
///
/// The v1 contract is frozen: these are the only behavioural types. Any new
/// type is a MAJOR schema increment + explicit decision (see AUDIT-V2 §4.3).
enum ZoneFieldType {
  text,
  longText,
  number,
  enumeration,
  stringList,
  link,
  unknown;

  static ZoneFieldType fromWire(Object? raw) {
    switch (raw) {
      case 'text':
        return ZoneFieldType.text;
      case 'longText':
        return ZoneFieldType.longText;
      case 'number':
        return ZoneFieldType.number;
      case 'enum':
        return ZoneFieldType.enumeration;
      case 'stringList':
        return ZoneFieldType.stringList;
      case 'link':
        return ZoneFieldType.link;
      default:
        return ZoneFieldType.unknown;
    }
  }
}
