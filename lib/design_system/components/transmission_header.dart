import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../colors.dart';
import '../spacing.dart';
import '../typography.dart';
import 'animated_primitives.dart';

class TransmissionHeader extends StatelessWidget {
  const TransmissionHeader({super.key, required this.label, this.sector});

  final String label;
  final String? sector;

  @override
  Widget build(BuildContext context) {
    final s = sector ?? 'ESSI//${100 + math.Random().nextInt(900)}';
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        border: Border(
          bottom: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
      ),
      child: Row(
        children: [
          const PulsingDot(color: AppColors.accentSuccess),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label.toUpperCase(),
              style: AppTypography.mono.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 2,
                color: AppColors.accentPrimary,
              ),
            ),
          ),
          Text(
            s,
            style: AppTypography.mono.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: AppColors.textDim,
            ),
          ),
        ],
      ),
    );
  }
}
