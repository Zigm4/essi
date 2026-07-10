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

/// The tag-pinned manifest: the catalogue of every map available at a content
/// version, with integrity metadata for each document and asset.
@immutable
class MapsManifest {
  final int schemaVersion;
  final String contentVersion;
  final String minAppVersion;
  final String cdnBase;
  final List<MapDescriptor> maps;

  const MapsManifest({
    required this.schemaVersion,
    required this.contentVersion,
    required this.minAppVersion,
    required this.cdnBase,
    required this.maps,
  });

  factory MapsManifest.fromJson(Map<String, dynamic> j) => MapsManifest(
    schemaVersion: (j['schemaVersion'] as num).toInt(),
    contentVersion: j['contentVersion'] as String,
    minAppVersion: j['minAppVersion'] as String,
    cdnBase: j['cdnBase'] as String,
    maps: ((j['maps'] as List<dynamic>?) ?? const [])
        .map((m) => MapDescriptor.fromJson(m as Map<String, dynamic>))
        .toList(growable: false),
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

/// A single interactive region of a map.
@immutable
class MapZone {
  final String id;
  final String name;
  final ZoneGeometry geometry;
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
  });

  factory MapZone.fromJson(Map<String, dynamic> j) {
    final anchor = j['labelAnchor'];
    // Per-zone overrides are restricted to {zoneFill, zoneStroke, glow}: a zone
    // may not repaint map-level tokens (background/surface/label/font), which
    // would bypass the map theme's dark-guard + contrast sanitization (§4.6).
    final override = j['themeOverride'] == null
        ? null
        : MapThemeOverride.fromJson(j['themeOverride'] as Map<String, dynamic>)
            .zoneRestricted();
    return MapZone(
      id: j['id'] as String,
      name: j['name'] as String,
      geometry: ZoneGeometry.fromJson(j['geometry'] as Map<String, dynamic>),
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
  });

  factory MapDocument.fromJson(Map<String, dynamic> j) => MapDocument(
    schemaVersion: (j['schemaVersion'] as num).toInt(),
    id: j['id'] as String,
    type: MapType.fromWire(j['type']),
    canvas: j['canvas'] == null
        ? null
        : MapCanvas.fromJson(j['canvas'] as Map<String, dynamic>),
    sphere: j['sphere'] == null
        ? null
        : SphereSpec.fromJson(j['sphere'] as Map<String, dynamic>),
    theme: MapTheme.fromJson(j['theme'] as Map<String, dynamic>?),
    fieldsSchema: ((j['fieldsSchema'] as List<dynamic>?) ?? const [])
        .map((f) => ZoneFieldSpec.fromJson(f as Map<String, dynamic>))
        .toList(growable: false),
    zones: ((j['zones'] as List<dynamic>?) ?? const [])
        .map((z) => MapZone.fromJson(z as Map<String, dynamic>))
        .toList(growable: false),
  );
}
