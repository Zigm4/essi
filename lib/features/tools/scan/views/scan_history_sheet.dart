import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../history/history_sheet.dart';
import '../data/scan_repository.dart';
import '../domain/scan_models.dart';
import 'scan_history_detail_view.dart';

class ScanHistorySheet extends StatelessWidget {
  const ScanHistorySheet({super.key});

  @override
  Widget build(BuildContext context) {
    return HistorySheet<List<PlanetPosition>>(
      title: 'Scan history',
      provider: scanHistoryProvider,
      emptyTitle: 'No scans yet',
      emptySubtitle: 'Run a scan from the Tools tab to populate history.',
      errorTitle: "Couldn't load scan history",
      clearTitle: 'Delete all scans?',
      // clear() deletes the whole table; the visible count is capped at
      // kHistoryLimit so we don't quote a number that could under-report.
      clearMessage: (_) =>
          "All saved scans will be removed. This can't be undone.",
      onClearAll: (ref) => ref.read(scanRepositoryProvider).clear(),
      deleteTitle: 'Delete scan?',
      onDelete: (ref, id) => ref.read(scanRepositoryProvider).delete(id),
      rowBuilder: (context, ref, entry) {
        // Decodes only this visible row's payload (F23).
        final count = entry.detail.length;
        final mode = ScanModeX.fromId(entry.mode);
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
          onLongPress: () => confirmHistoryDelete(
            context,
            ref,
            title: 'Delete scan?',
            onConfirm: () => ref.read(scanRepositoryProvider).delete(entry.id),
          ),
          child: GlassCard(
            child: Row(
              children: [
                Icon(
                  entry.errored ? Icons.warning : Icons.check_circle,
                  color: entry.errored
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
                        DateFormat('d MMM yyyy, HH:mm:ss')
                            .format(entry.date.toLocal()),
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
                                color: AppColors.accentPrimary
                                    .withValues(alpha: 0.6),
                                width: 0.7,
                              ),
                            ),
                            child: Text(
                              mode.label.toUpperCase(),
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
                            '$count planet${count == 1 ? '' : 's'}',
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
      },
    );
  }
}
