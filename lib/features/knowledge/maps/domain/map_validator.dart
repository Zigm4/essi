import 'map_models.dart';
import 'map_refs.dart';

/// Hard bounds enforced by [MapContentValidator]. Every one of these is a
/// *reject* condition — content that trips a bound is refused wholesale, which
/// is different from the must-ignore parsing of unknown enums/types/fields.
class MapLimits {
  MapLimits._();

  // Byte-size caps (caller supplies the decoded byte length).
  static const int pointerMaxBytes = 64 * 1024; // 64 KB
  static const int manifestMaxBytes = 256 * 1024; // 256 KB
  static const int documentMaxBytes = 2 * 1024 * 1024; // 2 MB

  // Structural counts.
  static const int maxMaps = 60;
  static const int maxZonesPerMap = 500;
  static const int maxVerticesPerZone = 5000;
  static const int maxFieldsSchema = 25;
  static const int maxOptionsPerField = 12;

  // Image bounds (validated from manifest-declared metadata).
  static const int maxImageBytes = 8 * 1024 * 1024; // 8 MB
  static const int maxImageDimension = 4096; // px per side

  // String length caps.
  static const int maxIdLength = 64;
  static const int maxTitleLength = 160;
  static const int maxSubtitleLength = 240;
  static const int maxTagLength = 40;
  static const int maxTags = 32;
  static const int maxZoneNameLength = 160;
  static const int maxFieldKeyLength = 64;
  static const int maxFieldLabelLength = 120;
  static const int maxOptionLength = 60;
  static const int maxUnitLength = 24;
  static const int maxStyleLength = 32;
  static const int maxPathLength = 256;
  static const int maxSha256Length = 64;
  static const int maxVersionStringLength = 40;
  static const int maxCdnBaseLength = 512;
  static const int maxTextureAssetLength = 64;
}

/// Machine-readable reason a content file was rejected.
enum MapValidationCode {
  /// The declared/decoded byte length exceeded a size cap.
  tooLarge,

  /// JSON was structurally malformed (missing required field, wrong JSON type,
  /// broken geometry coordinates). Wraps any exception thrown during parsing.
  malformedStructure,

  tooManyMaps,
  tooManyZones,
  tooManyVertices,
  tooManyFields,
  tooManyOptions,

  /// A string exceeded its length cap.
  stringTooLong,

  /// An image asset's declared byte size exceeded [MapLimits.maxImageBytes].
  imageTooLarge,

  /// An image asset's declared pixel size exceeded [MapLimits.maxImageDimension].
  imageDimensionsTooLarge,

  /// A numeric value was out of range (negative bytes, non-finite/≤0 canvas…).
  invalidBounds,
}

/// The outcome of a validation call: either a parsed object or a typed failure.
/// Never throws — parsing exceptions are captured as [malformedStructure].
sealed class MapParseResult<T> {
  const MapParseResult();

  bool get isOk => this is MapParseOk<T>;

  T? get valueOrNull =>
      this is MapParseOk<T> ? (this as MapParseOk<T>).value : null;
}

class MapParseOk<T> extends MapParseResult<T> {
  final T value;
  const MapParseOk(this.value);
}

class MapParseError<T> extends MapParseResult<T> {
  final MapValidationCode code;
  final String message;
  const MapParseError(this.code, this.message);

  @override
  String toString() => 'MapParseError($code): $message';
}

/// Internal sentinel used by the private bound checks. `null` == "passed".
class _Fail {
  final MapValidationCode code;
  final String message;
  const _Fail(this.code, this.message);
}

/// Strict, allocation-light validator for the three content documents. Applies
/// [MapLimits] and returns a typed [MapParseResult] — it never throws raw.
class MapContentValidator {
  const MapContentValidator();

  /// Validates the mutable pointer. [byteLength] is the raw JSON size.
  MapParseResult<MapsPointer> validatePointer(
    Map<String, dynamic> json, {
    required int byteLength,
  }) {
    if (byteLength > MapLimits.pointerMaxBytes) {
      return MapParseError(
        MapValidationCode.tooLarge,
        'pointer $byteLength B > ${MapLimits.pointerMaxBytes} B cap',
      );
    }
    final MapsPointer p;
    try {
      p = MapsPointer.fromJson(json);
    } catch (e) {
      return MapParseError(MapValidationCode.malformedStructure, 'pointer: $e');
    }
    final fail =
        _cap(p.contentVersion, MapLimits.maxVersionStringLength, 'contentVersion') ??
        _cap(p.tag, MapLimits.maxVersionStringLength, 'tag') ??
        _cap(p.minAppVersion, MapLimits.maxVersionStringLength, 'minAppVersion') ??
        _checkFileRef(p.manifest);
    return _wrap(fail, p);
  }

  /// Validates the tag-pinned manifest. [byteLength] is the raw JSON size.
  MapParseResult<MapsManifest> validateManifest(
    Map<String, dynamic> json, {
    required int byteLength,
  }) {
    if (byteLength > MapLimits.manifestMaxBytes) {
      return MapParseError(
        MapValidationCode.tooLarge,
        'manifest $byteLength B > ${MapLimits.manifestMaxBytes} B cap',
      );
    }
    final MapsManifest m;
    try {
      m = MapsManifest.fromJson(json);
    } catch (e) {
      return MapParseError(MapValidationCode.malformedStructure, 'manifest: $e');
    }
    if (m.maps.length > MapLimits.maxMaps) {
      return MapParseError(
        MapValidationCode.tooManyMaps,
        '${m.maps.length} maps > ${MapLimits.maxMaps} cap',
      );
    }
    _Fail? fail =
        _cap(m.contentVersion, MapLimits.maxVersionStringLength, 'contentVersion') ??
        _cap(m.minAppVersion, MapLimits.maxVersionStringLength, 'minAppVersion') ??
        _cap(m.cdnBase, MapLimits.maxCdnBaseLength, 'cdnBase');
    if (fail == null) {
      for (final d in m.maps) {
        fail = _checkDescriptor(d);
        if (fail != null) break;
      }
    }
    return _wrap(fail, m);
  }

  /// Validates a map document. [byteLength] is the raw JSON size.
  MapParseResult<MapDocument> validateDocument(
    Map<String, dynamic> json, {
    required int byteLength,
  }) {
    if (byteLength > MapLimits.documentMaxBytes) {
      return MapParseError(
        MapValidationCode.tooLarge,
        'document $byteLength B > ${MapLimits.documentMaxBytes} B cap',
      );
    }
    final MapDocument doc;
    try {
      doc = MapDocument.fromJson(json);
    } catch (e) {
      return MapParseError(MapValidationCode.malformedStructure, 'document: $e');
    }
    if (doc.fieldsSchema.length > MapLimits.maxFieldsSchema) {
      return MapParseError(
        MapValidationCode.tooManyFields,
        '${doc.fieldsSchema.length} fields > ${MapLimits.maxFieldsSchema} cap',
      );
    }
    if (doc.zones.length > MapLimits.maxZonesPerMap) {
      return MapParseError(
        MapValidationCode.tooManyZones,
        '${doc.zones.length} zones > ${MapLimits.maxZonesPerMap} cap',
      );
    }
    _Fail? fail = _cap(doc.id, MapLimits.maxIdLength, 'id');
    // Canvas bounds (flat maps declare a positive, finite canvas).
    if (fail == null && doc.canvas != null) {
      final c = doc.canvas!;
      if (!(c.width.isFinite && c.height.isFinite && c.width > 0 && c.height > 0)) {
        fail = const _Fail(
          MapValidationCode.invalidBounds,
          'canvas dimensions must be finite and > 0',
        );
      }
    }
    if (fail == null && doc.sphere != null) {
      fail = _cap(doc.sphere!.textureAsset, MapLimits.maxTextureAssetLength,
          'sphere.textureAsset');
    }
    if (fail == null) {
      for (final f in doc.fieldsSchema) {
        fail = _checkFieldSpec(f);
        if (fail != null) break;
      }
    }
    if (fail == null) {
      for (final z in doc.zones) {
        fail = _checkZone(z);
        if (fail != null) break;
      }
    }
    return _wrap(fail, doc);
  }

  // --- descriptor / zone / field checks --------------------------------------

  _Fail? _checkDescriptor(MapDescriptor d) {
    final fail = _cap(d.id, MapLimits.maxIdLength, 'map.id') ??
        _cap(d.title, MapLimits.maxTitleLength, 'map.title') ??
        _capNullable(d.subtitle, MapLimits.maxSubtitleLength, 'map.subtitle') ??
        _checkTags(d.tags) ??
        _checkFileRef(d.document);
    if (fail != null) return fail;
    // The manifest declares the document's size; enforce the doc byte cap early.
    if (d.document.bytes > MapLimits.documentMaxBytes) {
      return _Fail(MapValidationCode.tooLarge,
          'map.document ${d.document.bytes} B > ${MapLimits.documentMaxBytes} B cap');
    }
    for (final a in d.assets) {
      final af = _checkAsset(a);
      if (af != null) return af;
    }
    return null;
  }

  _Fail? _checkAsset(MapAssetRef a) {
    final fail = _checkFileRef(a);
    if (fail != null) return fail;
    if (a.bytes > MapLimits.maxImageBytes) {
      return _Fail(MapValidationCode.imageTooLarge,
          'asset ${a.path} ${a.bytes} B > ${MapLimits.maxImageBytes} B cap');
    }
    final px = a.pixelSize;
    if (px != null &&
        (px.width > MapLimits.maxImageDimension ||
            px.height > MapLimits.maxImageDimension)) {
      return _Fail(MapValidationCode.imageDimensionsTooLarge,
          'asset ${a.path} ${px.width}x${px.height} > ${MapLimits.maxImageDimension}px cap');
    }
    return null;
  }

  _Fail? _checkFileRef(MapFileRef r) {
    if (r.bytes < 0) {
      return _Fail(MapValidationCode.invalidBounds, 'ref ${r.path} negative bytes');
    }
    return _cap(r.path, MapLimits.maxPathLength, 'ref.path') ??
        _cap(r.sha256, MapLimits.maxSha256Length, 'ref.sha256');
  }

  _Fail? _checkFieldSpec(ZoneFieldSpec f) {
    final fail = _cap(f.key, MapLimits.maxFieldKeyLength, 'field.key') ??
        _cap(f.label, MapLimits.maxFieldLabelLength, 'field.label') ??
        _capNullable(f.unit, MapLimits.maxUnitLength, 'field.unit') ??
        _capNullable(f.style, MapLimits.maxStyleLength, 'field.style');
    if (fail != null) return fail;
    final opts = f.options;
    if (opts != null) {
      if (opts.length > MapLimits.maxOptionsPerField) {
        return _Fail(MapValidationCode.tooManyOptions,
            'field ${f.key}: ${opts.length} options > ${MapLimits.maxOptionsPerField} cap');
      }
      for (final o in opts) {
        final of = _cap(o, MapLimits.maxOptionLength, 'field.option');
        if (of != null) return of;
      }
    }
    return null;
  }

  _Fail? _checkZone(MapZone z) {
    final fail = _cap(z.id, MapLimits.maxIdLength, 'zone.id') ??
        _cap(z.name, MapLimits.maxZoneNameLength, 'zone.name');
    if (fail != null) return fail;
    final vc = z.geometry.vertexCount;
    if (vc > MapLimits.maxVerticesPerZone) {
      return _Fail(MapValidationCode.tooManyVertices,
          'zone ${z.id}: $vc vertices > ${MapLimits.maxVerticesPerZone} cap');
    }
    return null;
  }

  _Fail? _checkTags(List<String> tags) {
    if (tags.length > MapLimits.maxTags) {
      return _Fail(MapValidationCode.stringTooLong,
          '${tags.length} tags > ${MapLimits.maxTags} cap');
    }
    for (final t in tags) {
      final tf = _cap(t, MapLimits.maxTagLength, 'tag');
      if (tf != null) return tf;
    }
    return null;
  }

  // --- primitives ------------------------------------------------------------

  _Fail? _cap(String value, int max, String field) => value.length > max
      ? _Fail(MapValidationCode.stringTooLong,
          '$field length ${value.length} > $max')
      : null;

  _Fail? _capNullable(String? value, int max, String field) =>
      value == null ? null : _cap(value, max, field);

  MapParseResult<T> _wrap<T>(_Fail? fail, T value) => fail == null
      ? MapParseOk<T>(value)
      : MapParseError<T>(fail.code, fail.message);
}
