import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/database/app_database.dart';
import '../domain/job_progress.dart';

export '../domain/job_progress.dart';

/// Reactive per-job progress store backed by the [JobStatus] table.
class JobStatusRepository {
  JobStatusRepository(this._db);
  final AppDatabase _db;

  /// Live map of jobId -> progress. Only non-todo rows are stored, so the map
  /// contains just the jobs that have been advanced.
  Stream<Map<String, JobProgress>> watchAll() {
    return _db.select(_db.jobStatus).watch().map((rows) => {
          for (final r in rows) r.jobId: JobProgress.fromWire(r.status),
        });
  }

  Future<JobProgress> statusOf(String jobId) async {
    final row = await (_db.select(_db.jobStatus)
          ..where((s) => s.jobId.equals(jobId)))
        .getSingleOrNull();
    return JobProgress.fromWire(row?.status);
  }

  /// Sets the progress for a job. Setting [JobProgress.todo] clears the row so
  /// the table only holds meaningfully-advanced jobs.
  Future<void> setStatus(String jobId, JobProgress status) async {
    if (status == JobProgress.todo) {
      await (_db.delete(_db.jobStatus)..where((s) => s.jobId.equals(jobId)))
          .go();
      return;
    }
    await _db.into(_db.jobStatus).insert(
          JobStatusCompanion.insert(
            jobId: jobId,
            status: status.wire,
            updatedAt: DateTime.now(),
          ),
          mode: InsertMode.insertOrReplace,
        );
  }
}

final jobStatusRepositoryProvider = Provider<JobStatusRepository>((ref) {
  return JobStatusRepository(ref.watch(appDatabaseProvider));
});

/// Live map of jobId -> [JobProgress]. Absent jobs are implicitly todo.
final jobStatusMapProvider =
    StreamProvider<Map<String, JobProgress>>((ref) {
  return ref.watch(jobStatusRepositoryProvider).watchAll();
});

/// Convenience: the progress of one job (defaults to todo).
final jobProgressProvider =
    Provider.family<JobProgress, String>((ref, jobId) {
  final map = ref.watch(jobStatusMapProvider).valueOrNull ?? const {};
  return map[jobId] ?? JobProgress.todo;
});
