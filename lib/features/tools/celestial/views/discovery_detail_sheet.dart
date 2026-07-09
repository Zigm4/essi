import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/neon_button.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../../tracker/domain/tracker_models.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';
import '../widgets/discovery_object_share_card.dart';

class DiscoveryDetailSheet extends ConsumerWidget {
  const DiscoveryDetailSheet({super.key, required this.object});

  final DiscoveredObject object;

  Color _statusColor() {
    switch (object.status) {
      case DiscoveryStatus.ok:
        return AppColors.accentSuccess;
      case DiscoveryStatus.caution:
        return AppColors.accentWarn;
      case DiscoveryStatus.danger:
        return AppColors.accentDanger;
      case DiscoveryStatus.unknown:
        return AppColors.textSecondary;
    }
  }

  String _statusEmoji() {
    switch (object.status) {
      case DiscoveryStatus.ok:
        return '🟢';
      case DiscoveryStatus.caution:
        return '🟡';
      case DiscoveryStatus.danger:
        return '🔴';
      case DiscoveryStatus.unknown:
        return '❓';
    }
  }

  String _statusLabel() {
    switch (object.status) {
      case DiscoveryStatus.ok:
        return 'Within normal parameters';
      case DiscoveryStatus.caution:
        return 'Short tracking window';
      case DiscoveryStatus.danger:
        return 'Potentially hazardous';
      case DiscoveryStatus.unknown:
        return 'Unclassified';
    }
  }

  String _statusExplanation() {
    if (object.isHazardous) {
      return 'Flagged as potentially hazardous (PHA=Y) by SBDB.';
    }
    final days = object.trackingPeriodDays ?? 0;
    if (days < 3) {
      return 'Short tracking window — orbit refinement may still be in progress.';
    }
    if (object.kind == CelestialKind.asteroid &&
        (object.diameterMeters ?? 0) > 140) {
      return 'Large diameter (>140 m). Worth watching.';
    }
    return 'Within normal parameters.';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                  'Close',
                  style: AppTypography.body
                      .copyWith(color: AppColors.textSecondary),
                ),
              ),
              leadingWidth: 80,
              title: Text('Discovery', style: AppTypography.headline),
              centerTitle: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.ios_share,
                      color: AppColors.accentPrimary),
                  tooltip: 'Share discovery',
                  onPressed: () async {
                    Haptics.of(ref).tap();
                    await ShareCardCapture.share(
                      context: context,
                      card: DiscoveryObjectShareCard(object: object),
                      fileName:
                          'underdeck-discovery-${DateTime.now().millisecondsSinceEpoch}.png',
                      text: 'Underdeck discovery',
                    );
                  },
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: PageScrollView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  MediaQuery.paddingOf(context).top +
                      kToolbarHeight +
                      AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.xxl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GlassCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(object.kind.emoji,
                              style: const TextStyle(fontSize: 30)),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  object.displayName,
                                  style: AppTypography.headline,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Text(
                                      'MPC',
                                      style: AppTypography.mono.copyWith(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w500,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      object.designation,
                                      style: AppTypography.mono.copyWith(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.accentSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    GlassCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _statusEmoji(),
                            style: const TextStyle(fontSize: 28),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _statusLabel(),
                                  style: AppTypography.body.copyWith(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: _statusColor(),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _statusExplanation(),
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Details',
                            icon: Icons.info_outline,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          _Row(label: 'Kind', value: object.kind.displayName),
                          _Row(
                            label: 'Designation',
                            value: object.designation,
                          ),
                          if (object.firstObs != null)
                            _Row(label: 'First obs.', value: object.firstObs!),
                          if (object.lastObs != null)
                            _Row(label: 'Last obs.', value: object.lastObs!),
                          if (object.trackingPeriodDays != null)
                            _Row(
                              label: 'Tracking',
                              value:
                                  '${object.trackingPeriodDays} day${object.trackingPeriodDays == 1 ? '' : 's'}',
                            ),
                          if (object.kind == CelestialKind.asteroid) ...[
                            if (object.diameterMeters != null)
                              _Row(
                                label: 'Diameter',
                                value:
                                    '${object.diameterMeters!.toStringAsFixed(0)} m',
                              ),
                            if (object.albedo != null)
                              _Row(
                                label: 'Albedo',
                                value: object.albedo!.toStringAsFixed(3),
                              ),
                            _Row(
                              label: 'PHA flag',
                              value: object.isHazardous ? 'Yes' : 'No',
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NeonButton(
                            title: 'Track this object live',
                            icon: Icons.center_focus_strong,
                            onPressed: () {
                              Haptics.of(ref).tap();
                              Navigator.of(context).pop();
                              GoRouter.of(context).push(
                                '/tools/tracker',
                                extra: TrackTarget(
                                  name: object.displayName,
                                  kind: object.kind,
                                  mpcID: object.designation,
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Opens the Tracker tool with this object pre-filled. Sends 1 GET to JPL Horizons.',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTypography.mono.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: AppTypography.mono.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
            textAlign: TextAlign.right,
          ),
        ],
      ),
    );
  }
}
