import 'package:flutter/material.dart';

import '../../colors.dart';
import '../../spacing.dart';
import '../../typography.dart';

class ParamRow extends StatelessWidget {
  const ParamRow({
    super.key,
    required this.name,
    required this.value,
    required this.note,
  });

  final String name;
  final String value;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            children: [
              Text(
                name,
                style: AppTypography.mono.copyWith(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentSecondary,
                ),
              ),
              Text(
                value,
                style: AppTypography.mono.copyWith(
                  fontSize: 11,
                  color: AppColors.accentPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            note,
            style: AppTypography.body.copyWith(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
