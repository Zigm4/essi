import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../history/history_sheet.dart';
import '../data/celestial_repository.dart';
import '../domain/celestial_kind.dart';

class DiscoveryHistorySheet extends StatelessWidget {
  const DiscoveryHistorySheet({super.key, required this.onReplay});

  final ValueChanged<DiscoveryEntry> onReplay;

  @override
  Widget build(BuildContext context) {
    return HistorySheet<DiscoveryDetail>(
      title: 'Discoveries history',
      provider: discoveryHistoryProvider,
      emptyTitle: 'No searches yet',
      errorTitle: "Couldn't load discoveries history",
      clearTitle: 'Delete all searches?',
      // clear() deletes the whole table; the visible count is capped at
      // kHistoryLimit so we don't quote a number that could under-report.
      clearMessage: (_) => 'All saved searches will be removed.',
      onClearAll: (ref) => ref.read(celestialRepositoryProvider).clear(),
      deleteTitle: 'Delete search?',
      onDelete: (ref, id) => ref.read(celestialRepositoryProvider).delete(id),
      rowBuilder: (context, ref, entry) {
        final kind = CelestialKindX.fromId(entry.mode);
        // Decodes only this visible row's payload (F23).
        final detail = entry.detail;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            Haptics.of(ref).tap();
            onReplay(entry);
          },
          onLongPress: () => confirmHistoryDelete(
            context,
            ref,
            title: 'Delete search?',
            onConfirm: () =>
                ref.read(celestialRepositoryProvider).delete(entry.id),
          ),
          child: GlassCard(
            child: Row(
              children: [
                Text(kind.emoji, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(kind.displayName, style: AppTypography.body),
                      const SizedBox(height: 2),
                      Text(
                        '${DateFormat('d MMM yyyy').format(detail.startDate.toLocal())} → ${DateFormat('d MMM yyyy').format(detail.endDate.toLocal())}',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${detail.results.length}',
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
      },
    );
  }
}
