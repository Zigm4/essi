import 'package:flutter/material.dart';

import '../../colors.dart';
import '../../spacing.dart';

/// Lightweight container used by the "How it works" sheets. No blur, just a
/// solid `bgGlass` fill + a subtle border. Cheap to stack many times.
class InfoCard extends StatelessWidget {
  const InfoCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: child,
    );
  }
}
