import 'package:drift/drift.dart';

import 'links_table.dart';
import 'notes_table.dart';
import 'ships_table.dart';

class Tags extends Table {
  TextColumn get id => text()();
  TextColumn get displayName => text()();
  // F44: the lowercase dedupe key is unique so the same tag can't be stored
  // twice under different ids.
  TextColumn get name => text().unique()();
  TextColumn get colorHex => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class NoteTags extends Table {
  // F44: hard foreign keys with ON DELETE CASCADE so join rows can't outlive
  // their parents (requires PRAGMA foreign_keys=ON, enabled in beforeOpen).
  TextColumn get noteId =>
      text().references(Notes, #id, onDelete: KeyAction.cascade)();
  TextColumn get tagId =>
      text().references(Tags, #id, onDelete: KeyAction.cascade)();

  @override
  Set<Column> get primaryKey => {noteId, tagId};
}

class LinkTags extends Table {
  TextColumn get linkId =>
      text().references(Links, #id, onDelete: KeyAction.cascade)();
  TextColumn get tagId =>
      text().references(Tags, #id, onDelete: KeyAction.cascade)();

  @override
  Set<Column> get primaryKey => {linkId, tagId};
}

class ShipTags extends Table {
  TextColumn get shipId =>
      text().references(Ships, #id, onDelete: KeyAction.cascade)();
  TextColumn get tagId =>
      text().references(Tags, #id, onDelete: KeyAction.cascade)();

  @override
  Set<Column> get primaryKey => {shipId, tagId};
}
