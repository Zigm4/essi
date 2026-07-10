import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../favorites/data/favorites_repository.dart';
import '../data/job_status_repository.dart';
import '../data/jobs_repository.dart';
import '../domain/job.dart';
import '../domain/job_filter.dart';

class JobFilterController extends StateNotifier<JobFilter> {
  JobFilterController() : super(JobFilter.empty);

  void update(JobFilter Function(JobFilter) f) => state = f(state);
  void reset() => state = JobFilter.empty;
  void setQuery(String q) => state = state.copyWith(query: q);
  void setSort(JobSort s) => state = state.copyWith(sort: s);

  void toggleStarredOnly() =>
      state = state.copyWith(starredOnly: !state.starredOnly);

  void toggleStatus(JobProgress status) {
    final next = {...state.statuses};
    if (!next.remove(status)) next.add(status);
    state = state.copyWith(statuses: next);
  }
}

final jobFilterControllerProvider =
    StateNotifierProvider<JobFilterController, JobFilter>(
  (ref) => JobFilterController(),
);

/// Live filtered + sorted list. Returns null while the repository is loading.
///
/// Combines the job-intrinsic [JobFilter.accepts] with the favorites/status
/// companion filters, which need the live favorites set + progress map.
final filteredJobsProvider = Provider<AsyncValue<List<Job>>>((ref) {
  final repoAsync = ref.watch(jobsRepositoryProvider);
  final filter = ref.watch(jobFilterControllerProvider);
  final starred = ref.watch(favoriteIdsProvider(FavoriteKind.job)).valueOrNull ??
      const <String>{};
  final statusMap =
      ref.watch(jobStatusMapProvider).valueOrNull ?? const <String, JobProgress>{};
  return repoAsync.whenData((repo) {
    final out = repo.all.where((j) {
      if (!filter.accepts(j)) return false;
      final id = j.id.toString();
      return filter.acceptsCompanion(
        isStarred: starred.contains(id),
        status: statusMap[id] ?? JobProgress.todo,
      );
    }).toList();
    out.sort(filter.sort.comparator);
    return out;
  });
});
