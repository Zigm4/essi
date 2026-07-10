import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/logging.dart';
import '../data/database/app_database.dart';
import 'app_settings.dart';
import 'backup_reminder.dart';
import 'data_export.dart';

/// P3/25: current backup snapshot for the reminder banner. Recomputed on
/// invalidation (e.g. after an export or an auto-backup) and whenever the UI
/// watching it rebuilds.
final backupStatusProvider = FutureProvider.autoDispose<BackupStatus>((ref) {
  return ref.watch(dataExportServiceProvider).backupStatus();
});

/// P3/25: drives the opt-in "Auto-backup" feature. Subscribes to the
/// database's write stream and, once enough changes have accrued (and the
/// setting is on), fires a Documents-directory export. Fire-and-forget: a
/// failure is logged and never surfaces to or blocks the UI.
class AutoBackupController {
  AutoBackupController(this._ref) {
    final db = _ref.read(appDatabaseProvider);
    // tableUpdates emits once per committed write batch; count those, not rows.
    _sub = db.tableUpdates().listen((_) => _onChange());
    _ref.onDispose(() => _sub?.cancel());
  }

  final Ref _ref;
  StreamSubscription<void>? _sub;
  int _changes = 0;
  bool _running = false;

  Future<void> _onChange() async {
    if (!_ref.read(appSettingsProvider).autoBackupEnabled) {
      _changes = 0;
      return;
    }
    _changes++;
    if (_changes < BackupReminder.autoBackupChangeThreshold) return;
    // Guard against overlap: the export itself only reads, so it won't retrigger
    // this listener, but a slow write could arrive mid-export. E7: bail before
    // resetting the counter so writes that accrue during an in-flight export
    // stay counted and re-trigger a backup once it finishes, instead of being
    // dropped.
    if (_running) return;
    _changes = 0;
    _running = true;
    try {
      await _ref.read(dataExportServiceProvider).exportToDocuments();
      // An auto-backup counts as a backup: refresh lastBackupAt so the reminder
      // banner stays quiet for users who have auto-backup on.
      await _ref.read(appSettingsProvider.notifier).markBackedUp();
      _ref.invalidate(backupStatusProvider);
    } catch (e, st) {
      logError('Auto-backup to Documents failed: $e', st);
    } finally {
      _running = false;
    }
  }
}

/// Instantiate once (watched by the app root) so the write-stream listener is
/// live for the whole session.
final autoBackupControllerProvider = Provider<AutoBackupController>((ref) {
  return AutoBackupController(ref);
});
