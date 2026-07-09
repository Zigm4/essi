import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

class DiscoveriesListShareCard extends StatelessWidget {
  const DiscoveriesListShareCard({
    super.key,
    required this.results,
    required this.kind,
    required this.startDate,
    required this.endDate,
  });

  final List<DiscoveredObject> results;
  final CelestialKind kind;
  final DateTime startDate;
  final DateTime endDate;

  String _statusEmoji(DiscoveryStatus s) {
    switch (s) {
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

  static const _maxRows = 30;

  @override
  Widget build(BuildContext context) {
    final cap = results.take(_maxRows).toList();
    final hidden = results.length - cap.length;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.bgDeepest,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.accentPrimary.withValues(alpha: 0.08),
            Colors.transparent,
          ],
        ),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'UNDERDECK · DISCOVERIES',
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                        color: AppColors.accentPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${DateFormat('d MMM yyyy').format(startDate.toLocal())} → ${DateFormat('d MMM yyyy').format(endDate.toLocal())}',
                      style: AppTypography.mono.copyWith(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppColors.accentPrimary.withValues(alpha: 0.6),
                    width: 0.7,
                  ),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(
                  kind.displayName.toUpperCase(),
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
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle.withValues(alpha: 0.5)),
          const SizedBox(height: AppSpacing.md),
          if (results.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Text(
                'No matches in this window.',
                style: AppTypography.caption,
              ),
            )
          else
            for (final obj in cap)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_statusEmoji(obj.status),
                        style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        obj.displayName,
                        style: AppTypography.body,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      obj.firstObs ?? '?',
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
          if (hidden > 0)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                '+$hidden more',
                style: AppTypography.caption,
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle.withValues(alpha: 0.5)),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(Icons.wifi_tethering, size: 9, color: AppColors.textDim),
              const SizedBox(width: 4),
              Text(
                'Generated by Underdeck · ESSI deep space discovery',
                style: AppTypography.mono.copyWith(
                  fontSize: 9,
                  color: AppColors.textDim,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
