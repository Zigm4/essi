import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/app_settings.dart';
import '../../../services/backup_controller.dart';
import '../../../services/backup_reminder.dart';
import '../../../services/data_export.dart';
import '../../../services/haptics.dart';

/// P3/25: dismissible "your data is local-only, back it up" banner. Renders
/// nothing unless [BackupReminder.shouldShowReminder] says it's due. Exposes an
/// Export action (reusing the share flow, anchored for the iPad popover) and a
/// dismiss that snoozes the reminder.
class BackupReminderBanner extends ConsumerStatefulWidget {
  const BackupReminderBanner({super.key});

  @override
  ConsumerState<BackupReminderBanner> createState() =>
      _BackupReminderBannerState();
}

class _BackupReminderBannerState extends ConsumerState<BackupReminderBanner> {
  final GlobalKey _key = GlobalKey();
  bool _exporting = false;

  Rect _originRect() {
    final ctx = _key.currentContext;
    final box = ctx?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return const Rect.fromLTWH(0, 0, 1, 1);
    return box.localToGlobal(Offset.zero) & box.size;
  }

  Future<void> _export() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    Haptics.of(ref).tap();
    final origin = _originRect();
    try {
      await ref.read(dataExportServiceProvider).shareExport(
            sharePositionOrigin: origin,
          );
      await ref.read(appSettingsProvider.notifier).markBackedUp();
      ref.invalidate(backupStatusProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(friendlyError(e,
                fallback: 'Export failed. Please try again.')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _dismiss() {
    Haptics.of(ref).tap();
    ref.read(appSettingsProvider.notifier).snoozeBackupReminder(
          DateTime.now().add(BackupReminder.snoozeDuration),
        );
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(appSettingsProvider);
    final status = ref.watch(backupStatusProvider).valueOrNull;
    if (status == null) return const SizedBox.shrink();

    final now = DateTime.now();
    final show = BackupReminder.shouldShowReminder(
      now: now,
      hasData: status.hasData,
      lastBackupAt: settings.lastBackupAt,
      lastChangedAt: status.lastChangedAt,
      snoozedUntil: settings.backupReminderSnoozedUntil,
    );
    if (!show) return const SizedBox.shrink();

    final label = BackupReminder.lastBackupLabel(
      now: now,
      lastBackupAt: settings.lastBackupAt,
    );

    return KeyedSubtree(
      key: _key,
      child: Container(
        margin: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          0,
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.accentWarn.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: AppColors.accentWarn.withValues(alpha: 0.45),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.backup_outlined,
                color: AppColors.accentWarn, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Back up your data',
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Everything lives on this device only — $label. '
                    'Export a copy so an uninstall can\'t wipe it.',
                    style: AppTypography.caption,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      _BannerButton(
                        label: _exporting ? 'Exporting…' : 'Export now',
                        icon: Icons.upload,
                        onTap: _exporting ? null : _export,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _BannerButton(
                        label: 'Later',
                        onTap: _dismiss,
                        subtle: true,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Semantics(
              button: true,
              label: 'Dismiss backup reminder',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _dismiss,
                child: const Padding(
                  padding: EdgeInsets.only(left: AppSpacing.xs),
                  child: Icon(Icons.close, color: AppColors.textDim, size: 18),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BannerButton extends StatelessWidget {
  const _BannerButton({
    required this.label,
    required this.onTap,
    this.icon,
    this.subtle = false,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool subtle;

  @override
  Widget build(BuildContext context) {
    final tint = subtle ? AppColors.textSecondary : AppColors.accentWarn;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: 8,
            ),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(
                color: subtle
                    ? AppColors.borderSubtle
                    : AppColors.accentWarn.withValues(alpha: 0.55),
              ),
              color: subtle
                  ? Colors.transparent
                  : AppColors.accentWarn.withValues(alpha: 0.12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, color: tint, size: 16),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: tint,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
