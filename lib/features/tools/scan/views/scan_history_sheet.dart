import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../data/scan_repository.dart';
import '../domain/scan_models.dart';
import 'scan_history_detail_view.dart';

class ScanHistorySheet extends ConsumerWidget {
  const ScanHistorySheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(scanHistoryProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
          child: Scaffold(
            backgroundColor: AppColors.bgDeepest,
            extendBodyBehindAppBar: true,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  'Done',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              leadingWidth: 80,
              title: Text('Scan history', style: AppTypography.headline),
              centerTitle: true,
              actions: [
                entriesAsync.when(
                  data: (entries) => entries.isEmpty
                      ? const SizedBox.shrink()
                      : IconButton(
                          icon: const Icon(
                            Icons.delete_outline,
                            color: AppColors.accentDanger,
                          ),
                          onPressed: () =>
                              _confirmClearAll(context, ref, entries.length),
                        ),
                  loading: () => const SizedBox.shrink(),
                  // Keep the purge control reachable even when history can't be
                  // read, so a user can recover from a poisoned store.
                  error: (_, _) => IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      color: AppColors.accentDanger,
                    ),
                    onPressed: () => _confirmClearAll(context, ref, null),
                  ),
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: entriesAsync.when(
                data: (entries) => entries.isEmpty
                    ? const _EmptyState()
                    : PageScrollView(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          MediaQuery.paddingOf(context).top +
                              kToolbarHeight +
                              AppSpacing.sm,
                          AppSpacing.md,
                          AppSpacing.xxl,
                        ),
                        child: Column(
                          children: [
                            for (final entry in entries) ...[
                              _HistoryRow(entry: entry),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ),
                      ),
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => const _ErrorState(),
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _confirmClearAll(
    BuildContext context,
    WidgetRef ref,
    int? count,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete all scans?', style: AppTypography.headline),
        content: Text(
          count == null
              ? "All saved scans will be removed. This can't be undone."
              : "$count scan${count == 1 ? '' : 's'} will be removed. This can't be undone.",
          style: AppTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete all',
              style: AppTypography.body.copyWith(
                color: AppColors.accentDanger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(scanRepositoryProvider).clear();
    }
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.warning_amber_rounded,
              size: 48,
              color: AppColors.accentDanger.withValues(alpha: 0.6),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text("Couldn't load scan history", style: AppTypography.headline),
            const SizedBox(height: 4),
            Text(
              'Some saved data may be corrupted. Use the delete button above to clear history and recover.',
              textAlign: TextAlign.center,
              style: AppTypography.caption,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.history,
              size: 48,
              color: AppColors.accentPrimary.withValues(alpha: 0.4),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('No scans yet', style: AppTypography.headline),
            const SizedBox(height: 4),
            Text(
              'Run a scan from the Tools tab to populate history.',
              style: AppTypography.caption,
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryRow extends ConsumerWidget {
  const _HistoryRow({required this.entry});
  final ScanHistoryRecord entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.md),
      onTap: () {
        Haptics.of(ref).tap();
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            fullscreenDialog: true,
            builder: (_) => ScanHistoryDetailView(entry: entry),
          ),
        );
      },
      onLongPress: () => _confirmDelete(context, ref),
      child: GlassCard(
        child: Row(
          children: [
            Icon(
              entry.hadErrors ? Icons.warning : Icons.check_circle,
              color: entry.hadErrors
                  ? AppColors.accentWarn
                  : AppColors.accentSuccess,
              size: 18,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    DateFormat('d MMM yyyy, HH:mm:ss').format(entry.date.toLocal()),
                    style: AppTypography.body,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          border: Border.all(
                            color: AppColors.accentPrimary.withValues(alpha: 0.6),
                            width: 0.7,
                          ),
                        ),
                        child: Text(
                          entry.mode.label.toUpperCase(),
                          style: AppTypography.mono.copyWith(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                            color: AppColors.accentPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${entry.snapshots.length} planet${entry.snapshots.length == 1 ? '' : 's'}',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textDim),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete scan?', style: AppTypography.headline),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete',
              style: AppTypography.body.copyWith(
                color: AppColors.accentDanger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(scanRepositoryProvider).delete(entry.id);
    }
  }
}

extension on ScanHistoryRecord {
  // helper extension placeholder
}
