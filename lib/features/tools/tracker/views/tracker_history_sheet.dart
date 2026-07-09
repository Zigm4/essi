import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../celestial/domain/celestial_kind.dart';
import '../../history/history_sheet.dart';
import '../data/tracker_repository.dart';
import '../domain/tracker_models.dart';

class TrackerHistorySheet extends StatelessWidget {
  const TrackerHistorySheet({super.key, required this.onPick});

  final ValueChanged<TrackTarget> onPick;

  @override
  Widget build(BuildContext context) {
    return HistorySheet<TrackerResult>(
      title: 'Tracker history',
      provider: trackerHistoryProvider,
      emptyTitle: 'No tracks yet',
      errorTitle: "Couldn't load tracker history",
      clearTitle: 'Delete all tracks?',
      // clear() deletes the whole table; the visible count is capped at
      // kHistoryLimit so we don't quote a number that could under-report.
      clearMessage: (_) => 'All saved tracks will be removed.',
      onClearAll: (ref) => ref.read(trackerRepositoryProvider).clear(),
      deleteTitle: 'Delete track?',
      onDelete: (ref, id) => ref.read(trackerRepositoryProvider).delete(id),
      rowBuilder: (context, ref, entry) {
        // Decodes only this visible row's payload (F23).
        final result = entry.detail;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            Haptics.of(ref).tap();
            onPick(TrackTarget(
              name: result.displayName,
              kind: result.kind,
              mpcID: result.mpcID,
            ));
          },
          onLongPress: () => confirmHistoryDelete(
            context,
            ref,
            title: 'Delete track?',
            onConfirm: () =>
                ref.read(trackerRepositoryProvider).delete(entry.id),
          ),
          child: GlassCard(
            child: Row(
              children: [
                Text(result.kind.emoji, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(result.displayName, style: AppTypography.headline),
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
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Sector ${result.sector}',
                      style: AppTypography.mono.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accentPrimary,
                      ),
                    ),
                    Text(
                      '${result.slRounded.toStringAsFixed(2)} SL',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
