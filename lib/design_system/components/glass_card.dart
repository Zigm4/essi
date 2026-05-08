import 'dart:ui';

import 'package:flutter/material.dart';

import '../colors.dart';
import '../spacing.dart';

class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.radius = AppRadius.md,
    this.glow = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final card = ClipRRect(
      borderRadius: r,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.bgGlass,
            borderRadius: r,
            border: Border.all(
              color: AppColors.borderSubtle,
              width: 1,
            ),
          ),
          padding: padding,
          child: child,
        ),
      ),
    );
    if (!glow) return card;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: r,
        boxShadow: [
          BoxShadow(
            color: AppColors.accentPrimary.withValues(alpha: 0.18),
            blurRadius: 14,
          ),
        ],
      ),
      child: card,
    );
  }
}
