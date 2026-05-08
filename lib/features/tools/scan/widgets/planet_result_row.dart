import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../domain/scan_models.dart';
import 'planet_glyph.dart';

class PlanetResultRow extends StatelessWidget {
  const PlanetResultRow({
    super.key,
    required this.row,
    this.staticGlyph = false,
  });

  final PlanetRow row;
  final bool staticGlyph;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: row.status is PlanetRowPending ? 0.55 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            PlanetGlyph(
              kind: PlanetKindX.fromName(row.name),
              staticOnly: staticGlyph,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(row.name, style: AppTypography.body),
                  const SizedBox(height: 2),
                  _SecondaryStatus(status: row.status),
                ],
              ),
            ),
            _TrailingStatus(status: row.status),
          ],
        ),
      ),
    );
  }
}

class _SecondaryStatus extends StatelessWidget {
  const _SecondaryStatus({required this.status});
  final PlanetRowStatus status;

  static String _formatNextChange(DateTime date) {
    final delta = date.difference(DateTime.now());
    if (delta.inDays > 365) {
      return DateFormat('d MMM yyyy').format(date.toLocal());
    }
    return DateFormat('d MMM yyyy, HH:mm').format(date.toLocal());
  }

  static Color _colorForNextChange(DateTime date) {
    final delta = date.difference(DateTime.now());
    if (delta.inDays <= 30) return AppColors.accentSuccess;
    if (delta.inDays <= 365) return AppColors.accentWarn;
    return AppColors.accentDanger;
  }

  @override
  Widget build(BuildContext context) {
    final monoStyle = AppTypography.mono.copyWith(fontSize: 10);
    return switch (status) {
      PlanetRowPending() => Text(
        'pending',
        style: monoStyle.copyWith(color: AppColors.textDim),
      ),
      PlanetRowOk(:final position) when position.nextChange != null => Text(
        '→ sector ${position.nextChange!.toSector} on ${_formatNextChange(position.nextChange!.date)}',
        style: monoStyle.copyWith(
          color: _colorForNextChange(position.nextChange!.date),
        ),
      ),
      PlanetRowOk(:final position) => Text(
        DateFormat('HH:mm:ss').format(position.timestamp.toLocal()),
        style: monoStyle.copyWith(color: AppColors.textDim),
      ),
      PlanetRowErrored(:final error) => Text(
        error.message,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: monoStyle.copyWith(color: AppColors.accentDanger),
      ),
    };
  }
}

class _TrailingStatus extends StatelessWidget {
  const _TrailingStatus({required this.status});
  final PlanetRowStatus status;

  @override
  Widget build(BuildContext context) {
    return switch (status) {
      PlanetRowPending() => const Icon(
        Icons.radio_button_unchecked,
        color: AppColors.textDim,
        size: 18,
      ),
      PlanetRowOk(:final position) => Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                'Sector',
                style: AppTypography.mono.copyWith(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '${position.sector}',
                style: AppTypography.mono.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '${position.distanceSL} SL',
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              color: AppColors.accentSecondary,
            ),
          ),
        ],
      ),
      PlanetRowErrored() => const Icon(
        Icons.error,
        color: AppColors.accentDanger,
        size: 20,
      ),
    };
  }
}
