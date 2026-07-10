import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../data/database/app_database.dart';

/// Reactive store for personal per-zone pins/notes (Phase E §6.1). All reads go
/// through drift `watch()` so pin badges and the "My map notes" list update live
/// as the user adds/edits/deletes notes.
class MapPinsRepository {
  MapPinsRepository(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();

  /// All pins for a single map, newest-edited first.
  Stream<List<MapPin>> watchForMap(String mapId) {
    final q = _db.select(_db.mapPins)
      ..where((p) => p.mapId.equals(mapId))
      ..orderBy([(p) => OrderingTerm.desc(p.updatedAt)]);
    return q.watch();
  }

  /// Every pin across all maps, newest-edited first (backs a global notes list).
  Stream<List<MapPin>> watchAll() {
    final q = _db.select(_db.mapPins)
      ..orderBy([(p) => OrderingTerm.desc(p.updatedAt)]);
    return q.watch();
  }

  /// The single pin attached to one zone (`null` when none exists). The UI keeps
  /// at most one pin per (mapId, zoneId) — the editor creates-or-updates it.
  Stream<MapPin?> watchForZone(String mapId, String zoneId) {
    final q = _db.select(_db.mapPins)
      ..where((p) => p.mapId.equals(mapId) & p.zoneId.equals(zoneId))
      ..limit(1);
    return q.watchSingleOrNull();
  }

  /// Set of zone ids in [mapId] that currently have a pin — cheap source for the
  /// per-zone pin indicators.
  Stream<Set<String>> watchPinnedZoneIds(String mapId) {
    final q = _db.select(_db.mapPins)..where((p) => p.mapId.equals(mapId));
    return q.watch().map((rows) => rows.map((r) => r.zoneId).toSet());
  }

  Future<MapPin?> pinForZone(String mapId, String zoneId) {
    return (_db.select(_db.mapPins)
          ..where((p) => p.mapId.equals(mapId) & p.zoneId.equals(zoneId))
          ..limit(1))
        .getSingleOrNull();
  }

  /// Creates a new pin for a zone, or updates the existing one's note in place
  /// (one pin per zone). Returns the row id. Empty/whitespace notes are treated
  /// as a delete so the UI never persists a blank pin.
  Future<void> savePin({
    required String mapId,
    required String zoneId,
    required String note,
  }) async {
    final trimmed = note.trim();
    final existing = await pinForZone(mapId, zoneId);
    if (trimmed.isEmpty) {
      if (existing != null) await deletePin(existing.id);
      return;
    }
    final now = DateTime.now();
    if (existing == null) {
      await _db.into(_db.mapPins).insert(
            MapPinsCompanion.insert(
              id: _uuid.v4(),
              mapId: mapId,
              zoneId: zoneId,
              note: Value(trimmed),
              createdAt: now,
              updatedAt: now,
            ),
          );
    } else {
      await (_db.update(_db.mapPins)..where((p) => p.id.equals(existing.id)))
          .write(MapPinsCompanion(
        note: Value(trimmed),
        updatedAt: Value(now),
      ));
    }
  }

  Future<void> deletePin(String id) async {
    await (_db.delete(_db.mapPins)..where((p) => p.id.equals(id))).go();
  }
}

final mapPinsRepositoryProvider = Provider<MapPinsRepository>((ref) {
  return MapPinsRepository(ref.watch(appDatabaseProvider));
});

/// Live pins for a single map (family key: mapId).
final mapPinsForMapProvider =
    StreamProvider.family<List<MapPin>, String>((ref, mapId) {
  return ref.watch(mapPinsRepositoryProvider).watchForMap(mapId);
});

/// Live pins across every map — backs the global "My map notes" list.
final allMapPinsProvider = StreamProvider<List<MapPin>>((ref) {
  return ref.watch(mapPinsRepositoryProvider).watchAll();
});

/// Zone-scope key for [zonePinProvider] / [pinnedZoneIdsProvider].
@immutable
class MapZoneRef {
  const MapZoneRef(this.mapId, this.zoneId);
  final String mapId;
  final String zoneId;

  @override
  bool operator ==(Object other) =>
      other is MapZoneRef && other.mapId == mapId && other.zoneId == zoneId;

  @override
  int get hashCode => Object.hash(mapId, zoneId);
}

/// Live single pin for one zone (family key: [MapZoneRef]).
final zonePinProvider =
    StreamProvider.family<MapPin?, MapZoneRef>((ref, key) {
  return ref
      .watch(mapPinsRepositoryProvider)
      .watchForZone(key.mapId, key.zoneId);
});

/// Live set of pinned zone ids for a map (family key: mapId).
final pinnedZoneIdsProvider =
    StreamProvider.family<Set<String>, String>((ref, mapId) {
  return ref.watch(mapPinsRepositoryProvider).watchPinnedZoneIds(mapId);
});
