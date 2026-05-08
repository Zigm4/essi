import 'package:drift/drift.dart';

class Ships extends Table {
  TextColumn get id => text()();
  TextColumn get name => text().withDefault(const Constant(''))();
  TextColumn get modelKey => text().nullable()();
  TextColumn get customModelLabel => text().nullable()();
  BoolColumn get registered => boolean().withDefault(const Constant(false))();
  TextColumn get locationKey => text().nullable()();
  TextColumn get customLocation => text().nullable()();
  IntColumn get locationZone => integer().nullable()();
  TextColumn get locationSector => text().nullable()();
  IntColumn get locationSL => integer().nullable()();
  IntColumn get hull => integer().nullable()();
  TextColumn get pilotName => text().nullable()();
  TextColumn get gunnerName => text().nullable()();
  TextColumn get cartographerName => text().nullable()();
  TextColumn get prospectorName => text().nullable()();
  TextColumn get signallerName => text().nullable()();
  TextColumn get technicianName => text().nullable()();
  TextColumn get sentryName => text().nullable()();
  TextColumn get fabricatorName => text().nullable()();
  TextColumn get medicName => text().nullable()();
  TextColumn get quartermasterName => text().nullable()();
  TextColumn get chefName => text().nullable()();
  TextColumn get alchemistName => text().nullable()();
  TextColumn get note => text().withDefault(const Constant(''))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
