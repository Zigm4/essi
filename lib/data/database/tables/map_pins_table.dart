import 'package:drift/drift.dart';

/// v5 (audit-v2 Phase E §6.1): personal pins/notes a user attaches to a single
/// zone of a dynamic map — the bridge from lookup → companion. Purely local
/// user content (not part of any installed map pack).
///
/// [id] is a client-generated uuid PK so rows survive export/import and re-sync
/// without collisions. [mapId] + [zoneId] identify the target zone; they are
/// intentionally NOT foreign keys onto a maps table (map content lives in the
/// content-addressed blob store, not a relational table, and a pin must outlive
/// a temporarily-uninstalled pack). [note] is the free-text body.
class MapPins extends Table {
  TextColumn get id => text()();
  TextColumn get mapId => text()();
  TextColumn get zoneId => text()();
  TextColumn get note => text().withDefault(const Constant(''))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
