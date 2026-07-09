import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/jobs_repository.dart';
import '../domain/job.dart';
import '../domain/job_filter.dart';

class JobFilterController extends StateNotifier<JobFilter> {
  JobFilterController() : super(JobFilter.empty);

  void update(JobFilter Function(JobFilter) f) => state = f(state);
  void reset() => state = JobFilter.empty;
  void setQuery(String q) => state = state.copyWith(query: q);
  void setSort(JobSort s) => state = state.copyWith(sort: s);
}

final jobFilterControllerProvider =
    StateNotifierProvider<JobFilterController, JobFilter>(
  (ref) => JobFilterController(),
);

/// Live filtered + sorted list. Returns null while the repository is loading.
final filteredJobsProvider = Provider<AsyncValue<List<Job>>>((ref) {
  final repoAsync = ref.watch(jobsRepositoryProvider);
  final filter = ref.watch(jobFilterControllerProvider);
  return repoAsync.whenData((repo) {
    final out = repo.all.where(filter.accepts).toList();
    out.sort(filter.sort.comparator);
    return out;
  });
});
