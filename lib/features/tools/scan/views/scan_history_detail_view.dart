import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../data/scan_repository.dart';
import '../domain/scan_models.dart';
import '../widgets/planet_result_row.dart';
import '../widgets/scan_share_card.dart';

class ScanHistoryDetailView extends ConsumerWidget {
  const ScanHistoryDetailView({super.key, required this.entry});

  final ScanHistoryRecord entry;

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    await ShareCardCapture.share(
      context: context,
      card: ScanShareCard(
        mode: entry.mode,
        date: entry.date,
        snapshots: entry.snapshots,
      ),
      fileName:
          'underdeck-scan-${DateTime.now().millisecondsSinceEpoch}.png',
      text: 'Underdeck system scan',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            'Close',
            style: AppTypography.body.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
        leadingWidth: 80,
        title: Text(
          DateFormat('d MMM, HH:mm').format(entry.date.toLocal()),
          style: AppTypography.headline,
        ),
        centerTitle: true,
      ),
      body: AppBackground(
        child: PageScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Scan',
                      icon: Icons.center_focus_strong,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            DateFormat('d MMM yyyy, HH:mm:ss').format(entry.date.toLocal()),
                            style: AppTypography.body,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            border: Border.all(
                              color: AppColors.accentPrimary.withValues(
                                alpha: 0.6,
                              ),
                              width: 0.7,
                            ),
                          ),
                          child: Text(
                            entry.mode.label.toUpperCase(),
                            style: AppTypography.mono.copyWith(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.5,
                              color: AppColors.accentPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: SectionHeader(
                            title: 'Snapshot',
                            icon: Icons.public,
                          ),
                        ),
                        if (entry.snapshots.isNotEmpty)
                          IconButton(
                            onPressed: () => _share(context, ref),
                            icon: const Icon(Icons.ios_share,
                                color: AppColors.accentPrimary, size: 18),
                            tooltip: 'Share scan',
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (var i = 0; i < entry.snapshots.length; i++) ...[
                      PlanetResultRow(
                        row: PlanetRow(
                          name: entry.snapshots[i].name,
                          emoji: entry.snapshots[i].emoji,
                          status: PlanetRowOk(entry.snapshots[i]),
                        ),
                      ),
                      if (i < entry.snapshots.length - 1)
                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(vertical: 2),
                          color: AppColors.borderSubtle.withValues(alpha: 0.3),
                        ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
