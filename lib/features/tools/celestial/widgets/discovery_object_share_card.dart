import 'package:flutter/material.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

class DiscoveryObjectShareCard extends StatelessWidget {
  const DiscoveryObjectShareCard({super.key, required this.object});

  final DiscoveredObject object;

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

  @override
  Widget build(BuildContext context) {
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
          Text(
            'UNDERDECK · DISCOVERY',
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: AppColors.accentPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle.withValues(alpha: 0.5)),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(object.kind.emoji, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(object.displayName, style: AppTypography.headline),
                    const SizedBox(height: 2),
                    Text(
                      'MPC ${object.designation}',
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle.withValues(alpha: 0.5)),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Text(_statusEmoji(), style: const TextStyle(fontSize: 22)),
              const SizedBox(width: AppSpacing.sm),
              Text(_statusLabel(), style: AppTypography.body),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _Row(label: 'Kind', value: object.kind.displayName),
          _Row(label: 'Designation', value: object.designation),
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
                value: '${object.diameterMeters!.toStringAsFixed(0)} m',
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
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
