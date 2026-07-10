import 'package:flutter/material.dart';

import '../../colors.dart';
import '../../typography.dart';

class WindowRow extends StatelessWidget {
  const WindowRow({
    super.key,
    required this.planet,
    required this.broad,
    required this.refine,
  });

  final String planet;
  final String broad;
  final String refine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            planet,
            style: AppTypography.mono.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.accentSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Coarse',
                      style: AppTypography.mono.copyWith(
                        fontSize: 9,
                        color: AppColors.textDim,
                      ),
                    ),
                    Text(
                      broad,
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Refine',
                      style: AppTypography.mono.copyWith(
                        fontSize: 9,
                        color: AppColors.textDim,
                      ),
                    ),
                    Text(
                      refine,
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
        ],
      ),
    );
  }
}
