import 'package:drift/drift.dart';

class Tags extends Table {
  TextColumn get id => text()();
  TextColumn get displayName => text()();
  TextColumn get name => text()();
  TextColumn get colorHex => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class NoteTags extends Table {
  TextColumn get noteId => text()();
  TextColumn get tagId => text()();

  @override
  Set<Column> get primaryKey => {noteId, tagId};
}

class LinkTags extends Table {
  TextColumn get linkId => text()();
  TextColumn get tagId => text()();

  @override
  Set<Column> get primaryKey => {linkId, tagId};
}

class ShipTags extends Table {
  TextColumn get shipId => text()();
  TextColumn get tagId => text()();

  @override
  Set<Column> get primaryKey => {shipId, tagId};
}
