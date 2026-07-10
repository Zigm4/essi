import 'package:flutter/foundation.dart';

/// Snapshot of the local database used to decide whether to nag about backups.
/// [hasData] is true when there is anything worth backing up; [lastChangedAt]
/// is the most recent mutation timestamp across all user data (or `null` when
/// the database is empty).
@immutable
class BackupStatus {
  final bool hasData;
  final DateTime? lastChangedAt;
  const BackupStatus({required this.hasData, this.lastChangedAt});

  static const empty = BackupStatus(hasData: false, lastChangedAt: null);
}

/// Pure decision logic for the P3/25 backup reminder + auto-export. No IO,
/// no Flutter dependencies beyond `@immutable` — everything is a static
/// function of explicit inputs so it can be unit-tested directly.
class BackupReminder {
  const BackupReminder._();

  /// The app is local-only, so nag once data is older than this since the last
  /// backup.
  static const Duration reminderThreshold = Duration(days: 30);

  /// How long a dismiss/snooze hides the banner for.
  static const Duration snoozeDuration = Duration(days: 7);

  /// Number of write events after which auto-backup fires (when enabled).
  static const int autoBackupChangeThreshold = 20;

  /// How many auto-backup files to keep in the Documents directory.
  static const int autoBackupKeep = 3;

  /// Whole days between [lastBackupAt] and [now], or `null` if never backed up.
  /// Never negative (a clock that moved backwards clamps to 0).
  static int? daysSinceBackup({required DateTime now, DateTime? lastBackupAt}) {
    if (lastBackupAt == null) return null;
    final days = now.difference(lastBackupAt).inDays;
    return days < 0 ? 0 : days;
  }

  /// Whether the reminder banner should be visible right now.
  ///
  /// Shows only when there is data AND that data changed since the last backup
  /// AND either it was never backed up or the last backup is older than
  /// [threshold] — and it isn't currently snoozed.
  static bool shouldShowReminder({
    required DateTime now,
    required bool hasData,
    DateTime? lastBackupAt,
    DateTime? lastChangedAt,
    DateTime? snoozedUntil,
    Duration threshold = reminderThreshold,
  }) {
    if (!hasData) return false;
    if (snoozedUntil != null && now.isBefore(snoozedUntil)) return false;
    // Only nag when there is unsaved-elsewhere work: the newest change is
    // after the last backup (or there is no backup at all).
    final changedSinceBackup =
        lastBackupAt == null || (lastChangedAt?.isAfter(lastBackupAt) ?? true);
    if (!changedSinceBackup) return false;
    if (lastBackupAt == null) return true;
    return now.difference(lastBackupAt) >= threshold;
  }

  /// Short human label for the banner, e.g. "never backed up" /
  /// "backed up today" / "last backup 34 days ago".
  static String lastBackupLabel({
    required DateTime now,
    DateTime? lastBackupAt,
  }) {
    final days = daysSinceBackup(now: now, lastBackupAt: lastBackupAt);
    if (days == null) return 'never backed up';
    if (days == 0) return 'backed up today';
    if (days == 1) return 'last backup yesterday';
    return 'last backup $days days ago';
  }
}
