import 'package:drift/drift.dart';

class ScanHistory extends Table {
  TextColumn get id => text()();
  DateTimeColumn get date => dateTime()();
  TextColumn get mode => text()();
  TextColumn get payloadJson => text()();
  BoolColumn get errored => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

class TrackerHistory extends Table {
  TextColumn get id => text()();
  DateTimeColumn get date => dateTime()();
  TextColumn get mode => text()();
  TextColumn get payloadJson => text()();
  BoolColumn get errored => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

class DiscoveryHistory extends Table {
  TextColumn get id => text()();
  DateTimeColumn get date => dateTime()();
  TextColumn get mode => text()();
  TextColumn get payloadJson => text()();
  BoolColumn get errored => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}
