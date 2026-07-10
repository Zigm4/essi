import 'package:flutter/foundation.dart';

/// Pixel dimensions of an image asset, declared in the manifest so the app can
/// enforce the decode-size bound *before* fetching/decoding bytes.
@immutable
class ImageSize {
  final int width;
  final int height;

  const ImageSize(this.width, this.height);

  /// Parses a `[width, height]` JSON array. Throws (structural) if malformed.
  factory ImageSize.fromJson(Object? raw) {
    final l = raw as List<dynamic>;
    return ImageSize((l[0] as num).toInt(), (l[1] as num).toInt());
  }

  @override
  bool operator ==(Object other) =>
      other is ImageSize && other.width == width && other.height == height;

  @override
  int get hashCode => Object.hash(width, height);

  @override
  String toString() => 'ImageSize($width x $height)';
}

/// A reference to a content file (a map document or, via [MapAssetRef], an
/// image), carrying its integrity metadata. [sha256] pins the exact bytes and
/// [bytes] is the declared size used by the pre-download size bound.
@immutable
class MapFileRef {
  /// Repo-relative path under the tag, joined onto the manifest `cdnBase`.
  final String path;

  /// Lowercase hex sha256 of the referenced bytes.
  final String sha256;

  /// Declared byte length.
  final int bytes;

  /// Optional role hint (e.g. `background`, `thumbnail`, `texture`). Free-form.
  final String? kind;

  /// Optional declared pixel size (images only).
  final ImageSize? pixelSize;

  const MapFileRef({
    required this.path,
    required this.sha256,
    required this.bytes,
    this.kind,
    this.pixelSize,
  });

  factory MapFileRef.fromJson(Map<String, dynamic> j) => MapFileRef(
    path: j['path'] as String,
    sha256: j['sha256'] as String,
    bytes: (j['bytes'] as num).toInt(),
    kind: j['kind'] as String?,
    pixelSize: j['pixelSize'] == null ? null : ImageSize.fromJson(j['pixelSize']),
  );
}

/// A [MapFileRef] used specifically for a map's binary assets (images/textures).
/// Structurally identical to [MapFileRef]; the distinct type documents intent
/// and lets the validator apply image-specific bounds.
@immutable
class MapAssetRef extends MapFileRef {
  const MapAssetRef({
    required super.path,
    required super.sha256,
    required super.bytes,
    super.kind,
    super.pixelSize,
  });

  factory MapAssetRef.fromJson(Map<String, dynamic> j) => MapAssetRef(
    path: j['path'] as String,
    sha256: j['sha256'] as String,
    bytes: (j['bytes'] as num).toInt(),
    kind: j['kind'] as String?,
    pixelSize: j['pixelSize'] == null ? null : ImageSize.fromJson(j['pixelSize']),
  );
}
