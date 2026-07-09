import 'dart:ui';

import 'package:flutter/material.dart';

import '../colors.dart';
import '../spacing.dart';

/// Card with the Underdeck frosted-glass look.
///
/// Past versions always wrapped the body in a `BackdropFilter(blur 18×18)`.
/// On Android, painting 5+ such cards on screen at the same time (e.g. the
/// Jobs list, the Hangar list, the Knowledge categories) ramped the GPU and
/// heated the device noticeably. Most cards sit on a near-uniform deep-navy
/// background where the blur produces almost no visible effect.
///
/// Default behaviour is now **no real-time blur**: the fill colour and
/// borders alone deliver the visual identity at a fraction of the cost.
/// Pass `blur: true` for the rare cases where you have heavy content
/// behind the card (e.g. a hero card over a scanline-rich screen).
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.radius = AppRadius.md,
    this.glow = false,
    this.blur = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final bool glow;
  final bool blur;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final body = Container(
      decoration: BoxDecoration(
        // Slightly more opaque than the legacy bgGlass so the card still
        // reads cleanly without the BackdropFilter behind it. The colour
        // is unchanged otherwise — same hue, just less alpha bleed.
        color: AppColors.bgCard,
        borderRadius: r,
        border: Border.all(
          color: AppColors.borderSubtle,
          width: 1,
        ),
      ),
      padding: padding,
      child: child,
    );
    final clipped = blur
        ? ClipRRect(
            borderRadius: r,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: body,
            ),
          )
        : ClipRRect(borderRadius: r, child: body);
    if (!glow) return clipped;
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
      child: clipped,
    );
  }
}
