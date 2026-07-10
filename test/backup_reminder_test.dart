import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/services/backup_reminder.dart';

void main() {
  final now = DateTime(2026, 7, 9, 12);

  group('daysSinceBackup', () {
    test('null when never backed up', () {
      expect(BackupReminder.daysSinceBackup(now: now, lastBackupAt: null),
          isNull);
    });

    test('whole days elapsed', () {
      expect(
        BackupReminder.daysSinceBackup(
          now: now,
          lastBackupAt: now.subtract(const Duration(days: 34, hours: 5)),
        ),
        34,
      );
    });

    test('clamps a backwards clock to 0', () {
      expect(
        BackupReminder.daysSinceBackup(
          now: now,
          lastBackupAt: now.add(const Duration(days: 3)),
        ),
        0,
      );
    });
  });

  group('shouldShowReminder', () {
    test('hidden when there is no data', () {
      expect(
        BackupReminder.shouldShowReminder(now: now, hasData: false),
        isFalse,
      );
    });

    test('shown when data exists and was never backed up', () {
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastChangedAt: now.subtract(const Duration(minutes: 5)),
        ),
        isTrue,
      );
    });

    test('shown when last backup is older than the threshold and data changed',
        () {
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastBackupAt: now.subtract(const Duration(days: 31)),
          lastChangedAt: now.subtract(const Duration(days: 1)),
        ),
        isTrue,
      );
    });

    test('hidden when backed up recently', () {
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastBackupAt: now.subtract(const Duration(days: 3)),
          lastChangedAt: now.subtract(const Duration(days: 1)),
        ),
        isFalse,
      );
    });

    test('hidden when overdue but nothing changed since the last backup', () {
      final backup = now.subtract(const Duration(days: 40));
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastBackupAt: backup,
          // Newest change predates the backup → nothing new to lose.
          lastChangedAt: backup.subtract(const Duration(days: 1)),
        ),
        isFalse,
      );
    });

    test('changed exactly at the backup instant does not re-nag', () {
      final backup = now.subtract(const Duration(days: 40));
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastBackupAt: backup,
          lastChangedAt: backup,
        ),
        isFalse,
      );
    });

    test('hidden while snoozed, shown again after snooze expires', () {
      final base = BackupReminder.shouldShowReminder(
        now: now,
        hasData: true,
        lastBackupAt: now.subtract(const Duration(days: 40)),
        lastChangedAt: now.subtract(const Duration(days: 1)),
        snoozedUntil: now.add(const Duration(days: 2)),
      );
      expect(base, isFalse, reason: 'still snoozed');

      final expired = BackupReminder.shouldShowReminder(
        now: now,
        hasData: true,
        lastBackupAt: now.subtract(const Duration(days: 40)),
        lastChangedAt: now.subtract(const Duration(days: 1)),
        snoozedUntil: now.subtract(const Duration(minutes: 1)),
      );
      expect(expired, isTrue, reason: 'snooze elapsed');
    });

    test('never backed up but snoozed stays hidden', () {
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastChangedAt: now.subtract(const Duration(minutes: 5)),
          snoozedUntil: now.add(const Duration(days: 1)),
        ),
        isFalse,
      );
    });

    test('honours a custom threshold', () {
      expect(
        BackupReminder.shouldShowReminder(
          now: now,
          hasData: true,
          lastBackupAt: now.subtract(const Duration(days: 8)),
          lastChangedAt: now.subtract(const Duration(days: 1)),
          threshold: const Duration(days: 7),
        ),
        isTrue,
      );
    });
  });

  group('lastBackupLabel', () {
    test('never', () {
      expect(BackupReminder.lastBackupLabel(now: now, lastBackupAt: null),
          'never backed up');
    });

    test('today', () {
      expect(
        BackupReminder.lastBackupLabel(
          now: now,
          lastBackupAt: now.subtract(const Duration(hours: 2)),
        ),
        'backed up today',
      );
    });

    test('yesterday', () {
      expect(
        BackupReminder.lastBackupLabel(
          now: now,
          lastBackupAt: now.subtract(const Duration(days: 1, hours: 1)),
        ),
        'last backup yesterday',
      );
    });

    test('n days ago', () {
      expect(
        BackupReminder.lastBackupLabel(
          now: now,
          lastBackupAt: now.subtract(const Duration(days: 12)),
        ),
        'last backup 12 days ago',
      );
    });
  });
}
