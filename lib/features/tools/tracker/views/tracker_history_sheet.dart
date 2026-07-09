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
import '../../celestial/domain/celestial_kind.dart';
import '../data/tracker_repository.dart';
import '../domain/tracker_models.dart';

class TrackerHistorySheet extends ConsumerWidget {
  const TrackerHistorySheet({super.key, required this.onPick});

  final ValueChanged<TrackTarget> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(trackerHistoryProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
          child: Scaffold(
            backgroundColor: AppColors.bgDeepest,
            extendBodyBehindAppBar: true,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Done',
                    style: AppTypography.body
                        .copyWith(color: AppColors.textSecondary)),
              ),
              leadingWidth: 80,
              title: Text('Tracker history', style: AppTypography.headline),
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
                  // Keep the purge control reachable even when history can't be
                  // read, so a user can recover from a poisoned store.
                  error: (_, _) => IconButton(
                    icon: const Icon(Icons.delete_outline,
                        color: AppColors.accentDanger),
                    onPressed: () => _confirmClearAll(context, ref, null),
                  ),
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
                              Icon(Icons.history,
                                  size: 48,
                                  color: AppColors.accentPrimary
                                      .withValues(alpha: 0.4)),
                              const SizedBox(height: AppSpacing.sm),
                              Text('No tracks yet',
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
                              GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  Haptics.of(ref).tap();
                                  onPick(TrackTarget(
                                    name: entry.result.displayName,
                                    kind: entry.result.kind,
                                    mpcID: entry.result.mpcID,
                                  ));
                                },
                                onLongPress: () =>
                                    _confirmDelete(context, ref, entry.id),
                                child: GlassCard(
                                  child: Row(
                                    children: [
                                      Text(entry.result.kind.emoji,
                                          style:
                                              const TextStyle(fontSize: 22)),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(entry.result.displayName,
                                                style: AppTypography.headline),
                                            const SizedBox(height: 2),
                                            Text(
                                              DateFormat('d MMM yyyy, HH:mm')
                                                  .format(entry.date.toLocal()),
                                              style: AppTypography.caption,
                                            ),
                                          ],
                                        ),
                                      ),
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            'Sector ${entry.result.sector}',
                                            style: AppTypography.mono.copyWith(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.accentPrimary,
                                            ),
                                          ),
                                          Text(
                                            '${entry.result.slRounded.toStringAsFixed(2)} SL',
                                            style: AppTypography.caption,
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ),
                      ),
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            size: 48,
                            color: AppColors.accentDanger
                                .withValues(alpha: 0.6)),
                        const SizedBox(height: AppSpacing.sm),
                        Text("Couldn't load tracker history",
                            style: AppTypography.headline),
                        const SizedBox(height: 4),
                        Text(
                          'Some saved data may be corrupted. Use the delete button above to clear history and recover.',
                          textAlign: TextAlign.center,
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
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
    int? count,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete all tracks?', style: AppTypography.headline),
        content: Text(
          count == null
              ? 'All saved tracks will be removed.'
              : "$count entr${count == 1 ? 'y' : 'ies'} will be removed.",
          style: AppTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel',
                style: AppTypography.body
                    .copyWith(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Delete all',
                style: AppTypography.body
                    .copyWith(color: AppColors.accentDanger)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(trackerRepositoryProvider).clear();
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
        title: Text('Delete track?', style: AppTypography.headline),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel',
                style: AppTypography.body
                    .copyWith(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Delete',
                style: AppTypography.body
                    .copyWith(color: AppColors.accentDanger)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(trackerRepositoryProvider).delete(id);
    }
  }
}
