import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:rxdart/rxdart.dart';
import 'package:uuid/uuid.dart';

import '../../../data/database/app_database.dart';
import '../../captures/data/captures_repository.dart';
import '../../captures/domain/captures_models.dart';
import '../domain/hangar_models.dart';

class HangarRepository {
  HangarRepository(this._db, this._captures);

  final AppDatabase _db;
  final CapturesRepository _captures;
  static const _uuid = Uuid();

  ShipModel _fromRow(Ship row, List<TagModel> tags) {
    final roles = <ShipRight, String?>{
      ShipRight.pilot: row.pilotName,
      ShipRight.gunner: row.gunnerName,
      ShipRight.cartographer: row.cartographerName,
      ShipRight.prospector: row.prospectorName,
      ShipRight.signaller: row.signallerName,
      ShipRight.technician: row.technicianName,
      ShipRight.sentry: row.sentryName,
      ShipRight.fabricator: row.fabricatorName,
      ShipRight.medic: row.medicName,
      ShipRight.quartermaster: row.quartermasterName,
      ShipRight.chef: row.chefName,
      ShipRight.alchemist: row.alchemistName,
    };
    return ShipModel(
      id: row.id,
      name: row.name,
      modelKey: row.modelKey,
      customModelLabel: row.customModelLabel,
      registered: row.registered,
      locationKey: row.locationKey,
      customLocation: row.customLocation,
      locationZone: row.locationZone,
      locationSector: row.locationSector,
      locationSL: row.locationSL,
      hull: row.hull,
      roles: roles,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      tags: tags,
    );
  }

  Stream<List<ShipModel>> watchAll() {
    final shipsStream = _db.select(_db.ships).watch();
    final tagsJoinStream = _db.select(_db.shipTags).join([
      innerJoin(_db.tags, _db.tags.id.equalsExp(_db.shipTags.tagId)),
    ]).watch();
    return Rx.combineLatest2<List<Ship>, List<TypedResult>, List<ShipModel>>(
        shipsStream, tagsJoinStream, (shipsRows, joinRows) {
      final tagsByShip = <String, List<TagModel>>{};
      for (final row in joinRows) {
        final st = row.readTable(_db.shipTags);
        final tag = row.readTable(_db.tags);
        tagsByShip.putIfAbsent(st.shipId, () => []).add(TagModel(
              id: tag.id,
              displayName: tag.displayName,
              name: tag.name,
              colorHex: tag.colorHex,
            ));
      }
      final out = shipsRows
          .map((s) => _fromRow(s, tagsByShip[s.id] ?? const []))
          .toList();
      out.sort(
        (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
      );
      return out;
    });
  }

  Future<ShipModel> save(ShipModel current,
      {required List<String> tagDisplayNames}) async {
    final id = current.id.isEmpty ? _uuid.v4() : current.id;
    final now = DateTime.now();
    final companion = ShipsCompanion(
      id: Value(id),
      name: Value(current.name),
      modelKey: Value(current.modelKey),
      customModelLabel: Value(current.customModelLabel),
      registered: Value(current.registered),
      locationKey: Value(current.locationKey),
      customLocation: Value(current.customLocation),
      locationZone: Value(current.locationZone),
      locationSector: Value(current.locationSector),
      locationSL: Value(current.locationSL),
      hull: Value(current.hull),
      pilotName: Value(current.roles[ShipRight.pilot]),
      gunnerName: Value(current.roles[ShipRight.gunner]),
      cartographerName: Value(current.roles[ShipRight.cartographer]),
      prospectorName: Value(current.roles[ShipRight.prospector]),
      signallerName: Value(current.roles[ShipRight.signaller]),
      technicianName: Value(current.roles[ShipRight.technician]),
      sentryName: Value(current.roles[ShipRight.sentry]),
      fabricatorName: Value(current.roles[ShipRight.fabricator]),
      medicName: Value(current.roles[ShipRight.medic]),
      quartermasterName: Value(current.roles[ShipRight.quartermaster]),
      chefName: Value(current.roles[ShipRight.chef]),
      alchemistName: Value(current.roles[ShipRight.alchemist]),
      note: Value(current.note),
      createdAt: Value(current.id.isEmpty ? now : current.createdAt),
      updatedAt: Value(now),
    );
    // F45: keep the ship write, ship-tag join replacement and orphan pruning
    // atomic (nested transaction with resolveAndAttachShipTags).
    final tags = await _db.transaction(() async {
      if (current.id.isEmpty) {
        await _db.into(_db.ships).insert(companion);
      } else {
        await (_db.update(_db.ships)..where((t) => t.id.equals(id)))
            .write(companion);
      }
      // Replace ship-tag join rows
      final resolved =
          await _captures.resolveAndAttachShipTags(id, tagDisplayNames);
      await _captures.pruneOrphanTags();
      return resolved;
    });
    return ShipModel(
      id: id,
      name: current.name,
      modelKey: current.modelKey,
      customModelLabel: current.customModelLabel,
      registered: current.registered,
      locationKey: current.locationKey,
      customLocation: current.customLocation,
      locationZone: current.locationZone,
      locationSector: current.locationSector,
      locationSL: current.locationSL,
      hull: current.hull,
      roles: current.roles,
      note: current.note,
      createdAt: current.id.isEmpty ? now : current.createdAt,
      updatedAt: now,
      tags: tags,
    );
  }

  Future<void> delete(String id) async {
    // F45: atomic delete of the ship, its join rows and orphan pruning.
    await _db.transaction(() async {
      await (_db.delete(_db.shipTags)..where((t) => t.shipId.equals(id))).go();
      await (_db.delete(_db.ships)..where((t) => t.id.equals(id))).go();
      await _captures.pruneOrphanTags();
    });
  }
}

final hangarRepositoryProvider = Provider<HangarRepository>((ref) {
  return HangarRepository(
    ref.watch(appDatabaseProvider),
    ref.watch(capturesRepositoryProvider),
  );
});

final shipsStreamProvider = StreamProvider<List<ShipModel>>((ref) {
  return ref.watch(hangarRepositoryProvider).watchAll();
});
