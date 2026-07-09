import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/job.dart';

class JobsRepository {
  JobsRepository._(this._jobs);

  final List<Job> _jobs;
  List<Job> get all => _jobs;

  static const _assetPath = 'assets/catalog/jobs.json';

  static Future<JobsRepository> load() async {
    final raw = await rootBundle.loadString(_assetPath);
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
    return JobsRepository._(parsed);
  }
}

final jobsRepositoryProvider = FutureProvider<JobsRepository>((ref) async {
  return JobsRepository.load();
});
