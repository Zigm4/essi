import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:underdeck_app/core/logging.dart';

import '../domain/job.dart';

/// R9b: decodes the ~337KB jobs.json and builds its ~371 [Job]s. Top-level so
/// it can run on a background isolate via [compute], keeping the parse off the
/// UI isolate. Malformed rows are skipped individually so a single bad entry
/// can't kill the tool.
List<Job> parseJobsJson(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is! List) {
    throw StateError('jobs.json must be a JSON array, got ${decoded.runtimeType}');
  }
  final parsed = <Job>[];
  for (final entry in decoded) {
    if (entry is! Map<String, dynamic>) continue;
    try {
      parsed.add(Job.fromJson(entry));
    } catch (_) {
      // Skip malformed rows so a single bad entry doesn't kill the tool.
    }
  }
  return parsed;
}

class JobsRepository {
  JobsRepository._(this._jobs);

  final List<Job> _jobs;
  List<Job> get all => _jobs;

  static const _assetPath = 'assets/catalog/jobs.json';

  static Future<JobsRepository> load() async {
    try {
      final raw = await rootBundle.loadString(_assetPath);
      // R9b: parse on a background isolate so the large decode + Job.fromJson
      // pass doesn't jank the UI isolate on first open.
      final parsed = await compute(parseJobsJson, raw);
      return JobsRepository._(parsed);
    } catch (e, st) {
      logError('Failed to load $_assetPath: $e', st);
      rethrow;
    }
  }
}

final jobsRepositoryProvider = FutureProvider<JobsRepository>((ref) async {
  return JobsRepository.load();
});
