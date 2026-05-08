import 'package:flutter/material.dart';

import '../colors.dart';
import '../painters/hex_grid_painter.dart';
import '../painters/scanlines_painter.dart';
import 'cyber_particles.dart';

class AppBackground extends StatelessWidget {
  const AppBackground({
    super.key,
    required this.child,
    this.showsParticles = false,
    this.showsScanlines = true,
  });

  final Widget child;
  final bool showsParticles;
  final bool showsScanlines;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: AppColors.bgDeepest),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-1, -1),
                radius: 1.2,
                colors: [
                  AppColors.accentPrimary.withValues(alpha: 0.10),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          IgnorePointer(
            child: Opacity(
              opacity: 0.06,
              child: CustomPaint(painter: HexGridPainter(), size: Size.infinite),
            ),
          ),
          if (showsParticles) const CyberParticles(),
          child,
          if (showsScanlines)
            IgnorePointer(
              child: Opacity(
                opacity: 0.55,
                child: CustomPaint(
                  painter: ScanlinesPainter(),
                  size: Size.infinite,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
