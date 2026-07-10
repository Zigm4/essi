import 'package:flutter/foundation.dart';

/// A cross-link from some other content entry (a Job, a fishing zone, …) to a
/// place on a dynamic map (AUDIT-V2 Phase E §6.6).
///
/// This is a *reading* capability: content MAY carry a `mapRef` object and the
/// app renders a "View on map" affordance for it, but the shipped
/// jobs.json/fishing data carry none yet — [tryParse] is deliberately defensive
/// so a future content update can start using it with no app change (an absent
/// or malformed ref simply yields `null` and no button is shown).
@immutable
class MapRef {
  /// Target map id (matches a [MapDescriptor.id]). Required.
  final String mapId;

  /// Optional zone within the map to pre-select / centre on.
  final String? zoneId;

  const MapRef({required this.mapId, this.zoneId});

  /// Tolerant parse of a `mapRef` JSON value. Returns `null` when [raw] is
  /// absent, not an object, or missing a non-empty `mapId`. A blank/absent
  /// `zoneId` normalises to `null` (link to the map, no zone).
  static MapRef? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final mapId = raw['mapId'];
    if (mapId is! String || mapId.trim().isEmpty) return null;
    final zoneRaw = raw['zoneId'];
    final zoneId =
        (zoneRaw is String && zoneRaw.trim().isNotEmpty) ? zoneRaw.trim() : null;
    return MapRef(mapId: mapId.trim(), zoneId: zoneId);
  }

  /// The internal `underdeck://` link this ref resolves to, ready to hand to
  /// `resolveLink` / `resolveInternalLink`. Encodes its components so ids with
  /// reserved characters navigate correctly.
  String toInternalLink() {
    final id = Uri.encodeComponent(mapId);
    if (zoneId == null) return 'underdeck://map/$id';
    return 'underdeck://map/$id?zone=${Uri.encodeComponent(zoneId!)}';
  }

  @override
  bool operator ==(Object other) =>
      other is MapRef && other.mapId == mapId && other.zoneId == zoneId;

  @override
  int get hashCode => Object.hash(mapId, zoneId);

  @override
  String toString() => 'MapRef($mapId${zoneId == null ? '' : ', zone=$zoneId'})';
}
