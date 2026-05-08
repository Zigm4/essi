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
import '../data/celestial_repository.dart';
import '../domain/celestial_kind.dart';

class DiscoveryHistorySheet extends ConsumerWidget {
  const DiscoveryHistorySheet({super.key, required this.onReplay});

  final ValueChanged<DiscoveryHistoryRecord> onReplay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(discoveryHistoryProvider);
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
              title: Text('Discoveries history', style: AppTypography.headline),
              centerTitle: true,
              actions: [
                entriesAsync.when(
                  data: (entries) => entries.isEmpty
                      ? const SizedBox.shrink()
                      : IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: AppColors.accentDanger),
                          onPressed: () =>
                              _confirmClearAll(context, ref, entries.length),
                        ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: entriesAsync.when(
                data: (entries) => entries.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.history,
                                size: 48,
                                color: AppColors.accentPrimary
                                    .withValues(alpha: 0.4),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text('No searches yet',
                                  style: AppTypography.headline),
                            ],
                          ),
                        ),
                      )
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
                              _Row(
                                entry: entry,
                                onTap: () => onReplay(entry),
                                onDelete: () =>
                                    _confirmDelete(context, ref, entry.id),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ),
                      ),
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    'Error: $e',
                    style: AppTypography.body
                        .copyWith(color: AppColors.accentDanger),
                  ),
                ),
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
    int count,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete all searches?', style: AppTypography.headline),
        content: Text(
          "$count entr${count == 1 ? 'y' : 'ies'} will be removed.",
          style: AppTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body
                  .copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete all',
              style:
                  AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(celestialRepositoryProvider).clear();
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete search?', style: AppTypography.headline),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body
                  .copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete',
              style:
                  AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(celestialRepositoryProvider).delete(id);
    }
  }
}

class _Row extends ConsumerWidget {
  const _Row({
    required this.entry,
    required this.onTap,
    required this.onDelete,
  });

  final DiscoveryHistoryRecord entry;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Haptics.of(ref).tap();
        onTap();
      },
      onLongPress: onDelete,
      child: GlassCard(
        child: Row(
          children: [
            Text(entry.kind.emoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.kind.displayName,
                    style: AppTypography.body,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${DateFormat('d MMM yyyy').format(entry.startDate.toLocal())} → ${DateFormat('d MMM yyyy').format(entry.endDate.toLocal())}',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${entry.results.length}',
                  style: AppTypography.mono.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentPrimary,
                  ),
                ),
                Text('hits', style: AppTypography.caption),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
