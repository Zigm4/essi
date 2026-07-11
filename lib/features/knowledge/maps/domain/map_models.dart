import 'dart:ui' show Offset;

import 'package:flutter/foundation.dart';

import 'map_enums.dart';
import 'map_geometry.dart';
import 'map_refs.dart';
import 'map_theme.dart';

/// The mutable, signed pointer (`latest-v1.json`) at the top of the content
/// chain. Kept minuscule; points at an immutable, tag-pinned manifest.
@immutable
class MapsPointer {
  final int schemaVersion;
  final String contentVersion;
  final String tag;
  final String minAppVersion;
  final MapFileRef manifest;

  const MapsPointer({
    required this.schemaVersion,
    required this.contentVersion,
    required this.tag,
    required this.minAppVersion,
    required this.manifest,
  });

  factory MapsPointer.fromJson(Map<String, dynamic> j) => MapsPointer(
    schemaVersion: (j['schemaVersion'] as num).toInt(),
    contentVersion: j['contentVersion'] as String,
    tag: j['tag'] as String,
    minAppVersion: j['minAppVersion'] as String,
    manifest: MapFileRef.fromJson(j['manifest'] as Map<String, dynamic>),
  );
}

/// A single "what's new" note for a content version (AUDIT-V2 Phase E §6.3).
///
/// [version] is optional (a plain-string changelog, or an entry that omits it,
/// leaves it `null`); [notes] carries the human copy (markdown-ish, rendered as
/// plain text in the discreet gallery banner).
@immutable
class MapChangelogEntry {
  final String? version;
  final String notes;

  const MapChangelogEntry({required this.version, required this.notes});

  /// Tolerant parse of one changelog list item: a `{version, notes}` object, or
  /// a bare string (→ `notes`, no version). Returns `null` when it carries no
  /// usable notes text.
  static MapChangelogEntry? tryParse(Object? raw) {
    if (raw is String) {
      final t = raw.trim();
      return t.isEmpty ? null : MapChangelogEntry(version: null, notes: t);
    }
    if (raw is Map) {
      final notesRaw = raw['notes'];
      final notes = notesRaw is String ? notesRaw.trim() : '';
      if (notes.isEmpty) return null;
      final v = raw['version'];
      final version = (v is String && v.trim().isNotEmpty) ? v.trim() : null;
      return MapChangelogEntry(version: version, notes: notes);
    }
    return null;
  }
}

/// Parses the optional `changelog` manifest field (AUDIT-V2 §6.3). Must-ignore:
/// absent/malformed → empty list (never breaks old content). Accepts either a
/// single string (one entry) or a list of strings / `{version, notes}` objects;
/// non-conforming items are skipped.
List<MapChangelogEntry> parseChangelog(Object? raw) {
  if (raw == null) return const [];
  if (raw is String) {
    final e = MapChangelogEntry.tryParse(raw);
    return e == null ? const [] : [e];
  }
  if (raw is List) {
    return [
      for (final item in raw) ?MapChangelogEntry.tryParse(item),
    ];
  }
  return const [];
}

/// Whether the gallery "What's new" banner should surface for [contentVersion]
/// (AUDIT-V2 §6.3). Shows only when there is changelog content AND this content
/// version has not already been acknowledged (differs from [lastSeenVersion]).
/// Pure — the once-per-version state lives in prefs; this just decides.
bool shouldShowMapsChangelog({
  required String contentVersion,
  required String? lastSeenVersion,
  required bool hasChangelog,
}) =>
    hasChangelog &&
    contentVersion.isNotEmpty &&
    contentVersion != lastSeenVersion;

/// The tag-pinned manifest: the catalogue of every map available at a content
/// version, with integrity metadata for each document and asset.
@immutable
class MapsManifest {
  final int schemaVersion;
  final String contentVersion;
  final String minAppVersion;
  final String cdnBase;
  final List<MapDescriptor> maps;

  /// Optional "what's new" notes for this content version (AUDIT-V2 §6.3).
  /// Empty when the manifest omits `changelog` (must-ignore for old content).
  final List<MapChangelogEntry> changelog;

  const MapsManifest({
    required this.schemaVersion,
    required this.contentVersion,
    required this.minAppVersion,
    required this.cdnBase,
    required this.maps,
    this.changelog = const [],
  });

  factory MapsManifest.fromJson(Map<String, dynamic> j) => MapsManifest(
    schemaVersion: (j['schemaVersion'] as num).toInt(),
    contentVersion: j['contentVersion'] as String,
    minAppVersion: j['minAppVersion'] as String,
    cdnBase: j['cdnBase'] as String,
    maps: ((j['maps'] as List<dynamic>?) ?? const [])
        .map((m) => MapDescriptor.fromJson(m as Map<String, dynamic>))
        .toList(growable: false),
    changelog: parseChangelog(j['changelog']),
  );
}

/// A single map's catalogue entry in the manifest. `type` and `icon` parse
/// must-ignore (unknown -> the `unknown` enum member).
@immutable
class MapDescriptor {
  final String id;
  final MapType type;
  final String title;
  final String? subtitle;
  final MapIcon icon;
  final int order;
  final int version;
  final bool draft;
  final List<String> tags;
  final MapFileRef document;
  final List<MapAssetRef> assets;

  const MapDescriptor({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.order,
    required this.version,
    required this.draft,
    required this.tags,
    required this.document,
    required this.assets,
  });

  factory MapDescriptor.fromJson(Map<String, dynamic> j) => MapDescriptor(
    id: j['id'] as String,
    type: MapType.fromWire(j['type']),
    title: j['title'] as String,
    subtitle: j['subtitle'] as String?,
    icon: MapIcon.fromWire(j['icon']),
    order: (j['order'] as num?)?.toInt() ?? 0,
    version: (j['version'] as num?)?.toInt() ?? 1,
    draft: j['draft'] as bool? ?? false,
    tags: ((j['tags'] as List<dynamic>?) ?? const [])
        .map((e) => e as String)
        .toList(growable: false),
    document: MapFileRef.fromJson(j['document'] as Map<String, dynamic>),
    assets: ((j['assets'] as List<dynamic>?) ?? const [])
        .map((a) => MapAssetRef.fromJson(a as Map<String, dynamic>))
        .toList(growable: false),
  );
}

/// Canvas dimensions of a flat map, in the image's pixel space.
@immutable
class MapCanvas {
  final double width;
  final double height;

  const MapCanvas({required this.width, required this.height});

  factory MapCanvas.fromJson(Map<String, dynamic> j) => MapCanvas(
    width: (j['width'] as num).toDouble(),
    height: (j['height'] as num).toDouble(),
  );
}

/// Initial camera orientation for a sphere map (degrees).
@immutable
class SphereOrientation {
  final double lat;
  final double lon;

  const SphereOrientation({required this.lat, required this.lon});

  factory SphereOrientation.fromJson(Map<String, dynamic>? j) {
    j ??= const {};
    return SphereOrientation(
      lat: (j['lat'] as num?)?.toDouble() ?? 0.0,
      lon: (j['lon'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// Sphere-specific configuration for a globe map.
@immutable
class SphereSpec {
  /// Which asset (by `kind`) supplies the surface texture.
  final String textureAsset;
  final SphereOrientation initialOrientation;
  final double autoRotateDegPerSec;

  const SphereSpec({
    required this.textureAsset,
    required this.initialOrientation,
    required this.autoRotateDegPerSec,
  });

  factory SphereSpec.fromJson(Map<String, dynamic> j) => SphereSpec(
    textureAsset: j['textureAsset'] as String,
    initialOrientation:
        SphereOrientation.fromJson(j['initialOrientation'] as Map<String, dynamic>?),
    autoRotateDegPerSec: (j['autoRotateDegPerSec'] as num?)?.toDouble() ?? 0.0,
  );
}

/// A single content-defined field descriptor. Drives how a zone's value is
/// rendered and whether it is searchable/filterable.
///
/// RULE: `filterable` is only honoured for [ZoneFieldType.enumeration]. For any
/// other type it is dropped to `false` at parse time (unbounded filter chips
/// are a footgun — AUDIT-V2 §4.3).
@immutable
class ZoneFieldSpec {
  final String key;
  final String label;
  final ZoneFieldType type;
  final List<String>? options;
  final String? unit;
  final String? style;
  final bool searchable;
  final bool filterable;

  const ZoneFieldSpec({
    required this.key,
    required this.label,
    required this.type,
    required this.options,
    required this.unit,
    required this.style,
    required this.searchable,
    required this.filterable,
  });

  factory ZoneFieldSpec.fromJson(Map<String, dynamic> j) {
    final type = ZoneFieldType.fromWire(j['type']);
    final rawFilterable = j['filterable'] as bool? ?? false;
    return ZoneFieldSpec(
      key: j['key'] as String,
      label: j['label'] as String,
      type: type,
      options: (j['options'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(growable: false),
      unit: j['unit'] as String?,
      style: j['style'] as String?,
      searchable: j['searchable'] as bool? ?? false,
      // Honoured only for enumeration; dropped otherwise.
      filterable: rawFilterable && type == ZoneFieldType.enumeration,
    );
  }
}

/// The uniform lon/lat grid of a grid-sphere document (`"grid"`). Cells are
/// addressed by [GridPos] (0-based `[col, row]`, col 0 at lon −180, row 0 at the
/// north edge) and carry an *implicit* quad geometry derived here — grid zones
/// ship no per-zone geometry.
@immutable
class MapGrid {
  final int cols;
  final int rows;

  const MapGrid({required this.cols, required this.rows});

  /// Must-ignore parse: anything not shaped like `{"cols": int, "rows": int}`
  /// yields `null` (the doc simply has no grid; zones must then carry geometry).
  /// Range bounds (cols 2..72, rows 2..36) are the validator's job.
  static MapGrid? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final c = raw['cols'];
    final r = raw['rows'];
    if (c is! num || r is! num) return null;
    final cols = c.toInt();
    final rows = r.toInt();
    if (cols != c || rows != r) return null; // non-integer dimensions
    return MapGrid(cols: cols, rows: rows);
  }

  double get lonStep => 360.0 / cols;
  double get latStep => 180.0 / rows;

  /// Implicit bounds of cell ([col], [row]):
  /// `lonWest = -180 + col·(360/cols)`, `latNorth = 90 − row·(180/rows)`,
  /// with latitudes clamped to ±[kGridPoleClampLat] for pole robustness.
  ({double lonWest, double lonEast, double latNorth, double latSouth})
      cellBounds(int col, int row) {
    final lonWest = -180.0 + col * lonStep;
    return (
      lonWest: lonWest,
      lonEast: lonWest + lonStep,
      latNorth: (90.0 - row * latStep)
          .clamp(-kGridPoleClampLat, kGridPoleClampLat)
          .toDouble(),
      latSouth: (90.0 - (row + 1) * latStep)
          .clamp(-kGridPoleClampLat, kGridPoleClampLat)
          .toDouble(),
    );
  }

  /// Centre of cell ([col], [row]) — the representative point used for label
  /// placement and front-hemisphere culling.
  GeoPoint cellCenter(int col, int row) {
    final b = cellBounds(col, row);
    return GeoPoint(
      (b.lonWest + b.lonEast) / 2,
      (b.latNorth + b.latSouth) / 2,
    );
  }
}

/// A zone's 0-based cell address in a [MapGrid] (`"gridPos": [col, row]`).
@immutable
class GridPos {
  final int col;
  final int row;

  const GridPos(this.col, this.row);

  /// Must-ignore parse: anything not shaped like a `[col, row]` pair of
  /// non-negative integers yields `null`. Upper-range checks (col < cols,
  /// row < rows) are the validator's job.
  static GridPos? tryParse(Object? raw) {
    if (raw is! List || raw.length < 2) return null;
    final c = raw[0];
    final r = raw[1];
    if (c is! num || r is! num) return null;
    final col = c.toInt();
    final row = r.toInt();
    if (col != c || row != r) return null; // non-integer indices
    if (col < 0 || row < 0) return null;
    return GridPos(col, row);
  }

  @override
  bool operator ==(Object other) =>
      other is GridPos && other.col == col && other.row == row;

  @override
  int get hashCode => Object.hash(col, row);

  @override
  String toString() => 'GridPos($col, $row)';
}

/// A single interactive region of a map.
@immutable
class MapZone {
  final String id;
  final String name;

  /// Explicit geometry, or `null` for a grid-doc zone addressed by [gridPos]
  /// (its geometry is the implicit [MapGrid.cellBounds] quad). Never `null`
  /// outside a grid document — that is a structural parse error.
  final ZoneGeometry? geometry;

  /// Cell address in the document's [MapGrid], when this zone is a grid cell.
  final GridPos? gridPos;

  /// Optional display number for a grid cell (the community-spreadsheet cell
  /// number). Purely presentational.
  final int? cellNum;

  final Offset? labelAnchor;
  final MapThemeOverride? themeOverride;

  /// Free-form field values keyed by [ZoneFieldSpec.key]. Kept as dynamic JSON;
  /// interpretation is driven by the map's `fieldsSchema`.
  final Map<String, dynamic> fields;

  const MapZone({
    required this.id,
    required this.name,
    required this.geometry,
    required this.labelAnchor,
    required this.themeOverride,
    required this.fields,
    this.gridPos,
    this.cellNum,
  });

  /// Parses a zone. [grid] is the owning document's grid (or `null`): a zone
  /// may omit `geometry` IFF the doc has a grid AND the zone carries a usable
  /// `gridPos` — a zone with neither is a structural error (caught by the
  /// validator as `malformedStructure`). `gridPos`/`cellNum` themselves parse
  /// must-ignore (malformed → `null`).
  factory MapZone.fromJson(Map<String, dynamic> j, {MapGrid? grid}) {
    final anchor = j['labelAnchor'];
    // Per-zone overrides are restricted to {zoneFill, zoneStroke, glow}: a zone
    // may not repaint map-level tokens (background/surface/label/font), which
    // would bypass the map theme's dark-guard + contrast sanitization (§4.6).
    final override = j['themeOverride'] == null
        ? null
        : MapThemeOverride.fromJson(j['themeOverride'] as Map<String, dynamic>)
            .zoneRestricted();
    final gridPos = GridPos.tryParse(j['gridPos']);
    final geomJson = j['geometry'];
    final ZoneGeometry? geometry;
    if (geomJson == null) {
      if (grid == null || gridPos == null) {
        throw const FormatException(
            'zone has neither geometry nor a usable gridPos in a grid document');
      }
      geometry = null; // implicit grid-cell quad
    } else {
      geometry = ZoneGeometry.fromJson(geomJson as Map<String, dynamic>);
    }
    final cellNumRaw = j['cellNum'];
    return MapZone(
      id: j['id'] as String,
      name: j['name'] as String,
      geometry: geometry,
      gridPos: gridPos,
      cellNum: cellNumRaw is num ? cellNumRaw.toInt() : null,
      labelAnchor: anchor == null
          ? null
          : Offset(
              ((anchor as List<dynamic>)[0] as num).toDouble(),
              (anchor[1] as num).toDouble(),
            ),
      themeOverride: (override != null && override.isEmpty) ? null : override,
      fields: (j['fields'] as Map<String, dynamic>?) ?? const {},
    );
  }
}

/// A fully parsed map document (`map.json`).
@immutable
class MapDocument {
  final int schemaVersion;
  final String id;
  final MapType type;
  final MapCanvas? canvas;
  final SphereSpec? sphere;

  /// Uniform lon/lat grid for a grid-sphere document, or `null` for every
  /// other map. When present, zones may be addressed by [MapZone.gridPos]
  /// instead of explicit geometry.
  final MapGrid? grid;

  final MapTheme theme;
  final List<ZoneFieldSpec> fieldsSchema;
  final List<MapZone> zones;

  const MapDocument({
    required this.schemaVersion,
    required this.id,
    required this.type,
    required this.canvas,
    required this.sphere,
    required this.theme,
    required this.fieldsSchema,
    required this.zones,
    this.grid,
  });

  factory MapDocument.fromJson(Map<String, dynamic> j) {
    final grid = MapGrid.tryParse(j['grid']);
    return MapDocument(
      schemaVersion: (j['schemaVersion'] as num).toInt(),
      id: j['id'] as String,
      type: MapType.fromWire(j['type']),
      canvas: j['canvas'] == null
          ? null
          : MapCanvas.fromJson(j['canvas'] as Map<String, dynamic>),
      sphere: j['sphere'] == null
          ? null
          : SphereSpec.fromJson(j['sphere'] as Map<String, dynamic>),
      grid: grid,
      theme: MapTheme.fromJson(j['theme'] as Map<String, dynamic>?),
      fieldsSchema: ((j['fieldsSchema'] as List<dynamic>?) ?? const [])
          .map((f) => ZoneFieldSpec.fromJson(f as Map<String, dynamic>))
          .toList(growable: false),
      zones: ((j['zones'] as List<dynamic>?) ?? const [])
          .map((z) => MapZone.fromJson(z as Map<String, dynamic>, grid: grid))
          .toList(growable: false),
    );
  }
}
