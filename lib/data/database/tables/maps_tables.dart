import 'package:drift/drift.dart';

/// v4 (dynamic-maps M0): the offline index backing the content-addressed blob
/// store. The bytes themselves live on disk under `maps_store/blobs/<sha256>`;
/// these tables are the *index* over what is installed, plus the FTS5 search
/// table (declared as a raw virtual table in the migration — see
/// `AppDatabase._migrateToV4`).

/// One row per installed content version. [contentVersion] is the semver-ish
/// content string from the pointer (PK — the store keeps a single installed
/// version at a time, but the schema does not force that). [manifestSha256]
/// pins the manifest blob (stored in the blob store) so it can be re-read and
/// re-validated offline. [state] tracks the install lifecycle.
class MapPacks extends Table {
  TextColumn get contentVersion => text()();
  TextColumn get tag => text()();
  TextColumn get manifestSha256 => text()();
  DateTimeColumn get installedAt => dateTime()();

  /// One of {'installed','downloading','failed'}.
  TextColumn get state => text()();

  @override
  Set<Column> get primaryKey => {contentVersion};
}

/// One row per file (map document or image asset) referenced by a [MapPacks]
/// row. The `(contentVersion, logicalPath)` pair is unique within a pack;
/// [sha256] is the content address into the blob store and doubles as the GC
/// reference set (a blob with no [MapPackFiles] row for any installed pack is
/// collectable). [kind] mirrors the manifest hint ('document','background',
/// 'thumbnail','texture', …); nullable for forward compatibility.
class MapPackFiles extends Table {
  TextColumn get contentVersion => text()();
  TextColumn get logicalPath => text()();
  TextColumn get sha256 => text()();
  IntColumn get bytes => integer()();
  TextColumn get kind => text().nullable()();

  @override
  Set<Column> get primaryKey => {contentVersion, logicalPath};
}
