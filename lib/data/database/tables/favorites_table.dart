import 'package:drift/drift.dart';

/// Generic star/pin/bookmark across entity kinds (jobs, KB articles, fishing
/// zones, tracked objects). [entityType] is a stable kind key (see
/// `FavoriteEntity`), [entityId] the id within that kind. Composite PK keeps a
/// given entity favorited at most once.
class Favorites extends Table {
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {entityType, entityId};
}

/// Per-job progress status. [jobId] is the job id (stringified). [status] is one
/// of {'todo','in_progress','done'}; a job with no row is implicitly 'todo'.
class JobStatus extends Table {
  TextColumn get jobId => text()();
  TextColumn get status => text()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {jobId};
}
