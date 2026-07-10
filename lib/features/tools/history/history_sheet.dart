import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/logging.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import 'history_repository.dart';

/// Builds the visual for one history row. Called only for on-screen rows
/// (`ListView.builder`), so accessing `entry.detail` here decodes just the
/// visible payloads (F23). May throw on a corrupt payload — the sheet wraps
/// this and renders a recoverable fallback tile instead.
typedef HistoryRowBuilder<D> = Widget Function(
  BuildContext context,
  WidgetRef ref,
  HistoryEntry<D> entry,
);

/// Generic, reusable history bottom sheet (F64) — the single implementation
/// behind the scan / tracker / discovery history sheets. Preserves the prior
/// behavior: a purge (clear-all) control that stays reachable in the error
/// state so a poisoned store can always be recovered.
class HistorySheet<D> extends ConsumerWidget {
  const HistorySheet({
    super.key,
    required this.title,
    required this.provider,
    required this.emptyTitle,
    this.emptySubtitle,
    required this.errorTitle,
    required this.clearTitle,
    required this.clearMessage,
    required this.onClearAll,
    required this.rowBuilder,
    required this.deleteTitle,
    required this.onDelete,
  });

  final String title;
  final ProviderListenable<AsyncValue<List<HistoryEntry<D>>>> provider;
  final String emptyTitle;
  final String? emptySubtitle;
  final String errorTitle;

  /// Clear-all confirmation dialog title, e.g. 'Delete all scans?'.
  final String clearTitle;

  /// Builds the clear-all body; `count` is null when history couldn't be read.
  final String Function(int? count) clearMessage;
  final Future<void> Function(WidgetRef ref) onClearAll;

  final HistoryRowBuilder<D> rowBuilder;

  /// Confirmation title used by the corrupt-row fallback tile's delete action.
  final String deleteTitle;
  final Future<void> Function(WidgetRef ref, String id) onDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(provider);
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
                  style: AppTypography.body
                      .copyWith(color: AppColors.textSecondary),
                ),
              ),
              leadingWidth: 80,
              title: Text(title, style: AppTypography.headline),
              centerTitle: true,
              actions: [
                entriesAsync.when(
                  data: (entries) => entries.isEmpty
                      ? const SizedBox.shrink()
                      : _clearButton(context, ref, entries.length),
                  loading: () => const SizedBox.shrink(),
                  // Keep the purge control reachable even when history can't be
                  // read, so a user can recover from a poisoned store.
                  error: (_, _) => _clearButton(context, ref, null),
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: entriesAsync.when(
                data: (entries) => entries.isEmpty
                    ? _EmptyState(title: emptyTitle, subtitle: emptySubtitle)
                    : ListView.builder(
                        controller: scrollController,
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          MediaQuery.paddingOf(context).top +
                              kToolbarHeight +
                              AppSpacing.sm,
                          AppSpacing.md,
                          AppSpacing.xxl,
                        ),
                        itemCount: entries.length,
                        itemBuilder: (context, i) {
                          final entry = entries[i];
                          Widget child;
                          try {
                            // Decodes only this visible row's payload (F23).
                            child = rowBuilder(context, ref, entry);
                          } catch (e, st) {
                            // One corrupt payload degrades a single tile
                            // instead of the whole list (F16 tolerance).
                            logError(e, st);
                            child = _CorruptedRow(
                              onDelete: () => _confirmDelete(
                                context,
                                ref,
                                title: deleteTitle,
                                onConfirm: () => onDelete(ref, entry.id),
                              ),
                            );
                          }
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.sm,
                            ),
                            child: child,
                          );
                        },
                      ),
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => _ErrorState(title: errorTitle),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _clearButton(BuildContext context, WidgetRef ref, int? count) {
    return IconButton(
      icon: const Icon(Icons.delete_outline, color: AppColors.accentDanger),
      tooltip: clearTitle,
      onPressed: () async {
        final confirm = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.bgElevated,
            title: Text(clearTitle, style: AppTypography.headline),
            content: Text(clearMessage(count), style: AppTypography.body),
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
                  style: AppTypography.body
                      .copyWith(color: AppColors.accentDanger),
                ),
              ),
            ],
          ),
        );
        // E11: the dialog await can outlive the sheet; don't touch ref/context
        // if it's already gone.
        if (!context.mounted) return;
        if (confirm == true) {
          Haptics.of(ref).warning();
          await onClearAll(ref);
        }
      },
    );
  }
}

/// Shared single-entry delete confirmation used by feature row builders and the
/// corrupt-row fallback tile.
Future<void> confirmHistoryDelete(
  BuildContext context,
  WidgetRef ref, {
  required String title,
  required Future<void> Function() onConfirm,
}) =>
    _confirmDelete(context, ref, title: title, onConfirm: onConfirm);

Future<void> _confirmDelete(
  BuildContext context,
  WidgetRef ref, {
  required String title,
  required Future<void> Function() onConfirm,
}) async {
  final confirm = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.bgElevated,
      title: Text(title, style: AppTypography.headline),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(
            'Cancel',
            style:
                AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(
            'Delete',
            style: AppTypography.body.copyWith(color: AppColors.accentDanger),
          ),
        ),
      ],
    ),
  );
  // E11: the dialog await can outlive the caller's context; bail if it's gone.
  if (!context.mounted) return;
  if (confirm == true) {
    Haptics.of(ref).warning();
    await onConfirm();
  }
}

class _CorruptedRow extends StatelessWidget {
  const _CorruptedRow({required this.onDelete});

  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onLongPress: onDelete,
      child: GlassCard(
        child: Row(
          children: [
            Icon(
              Icons.warning_amber_rounded,
              color: AppColors.accentDanger.withValues(alpha: 0.8),
              size: 18,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Corrupted entry', style: AppTypography.body),
                  const SizedBox(height: 2),
                  Text(
                    'Long-press to delete this entry.',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

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
            Text(title, style: AppTypography.headline),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, style: AppTypography.caption),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.title});

  final String title;

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
            Text(title, style: AppTypography.headline),
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
