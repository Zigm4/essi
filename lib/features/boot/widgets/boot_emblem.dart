import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../services/app_settings.dart';
import 'hexagon_shape.dart';

class BootEmblem extends ConsumerWidget {
  const BootEmblem({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reduce = ref.watch(
      appSettingsProvider.select((s) => s.reduceAnimations),
    );
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    final skip = reduce || mqReduce;
    return SizedBox(
      width: 220,
      height: 220,
      child: skip ? const _StaticEmblem() : const _AnimatedEmblem(),
    );
  }
}

class _StaticEmblem extends StatelessWidget {
  const _StaticEmblem();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _RingBorder(
          size: 200,
          color: AppColors.borderSubtle,
          strokeWidth: 1,
        ),
        _RingBorder(
          size: 140,
          color: AppColors.accentPrimary.withValues(alpha: 0.4),
          strokeWidth: 1,
        ),
        _RingBorder(
          size: 90,
          color: AppColors.accentSecondary.withValues(alpha: 0.5),
          strokeWidth: 1,
        ),
        const _EmblemCore(),
      ],
    );
  }
}

class _AnimatedEmblem extends StatefulWidget {
  const _AnimatedEmblem();

  @override
  State<_AnimatedEmblem> createState() => _AnimatedEmblemState();
}

class _AnimatedEmblemState extends State<_AnimatedEmblem>
    with TickerProviderStateMixin {
  late final AnimationController _outer = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 14),
  )..repeat();
  late final AnimationController _middle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4500),
  )..repeat();
  late final AnimationController _inner = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 8),
  )..repeat();
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _outer.dispose();
    _middle.dispose();
    _inner.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_outer, _middle, _inner, _pulse]),
      builder: (context, _) {
        final pulseT = Curves.easeInOut.transform(_pulse.value);
        final scale = 1.0 + (1.06 - 1.0) * pulseT;
        final coreGlow = 0.6 + (0.85 - 0.6) * pulseT;
        return Stack(
          alignment: Alignment.center,
          children: [
            Transform.rotate(
              angle: -_outer.value * 2 * math.pi,
              child: CustomPaint(
                size: const Size.square(200),
                painter: _DashedRingPainter(
                  color: AppColors.borderSubtle,
                  strokeWidth: 1,
                  dash: 3,
                  gap: 7,
                ),
              ),
            ),
            for (var i = 0; i < 4; i++)
              Transform.rotate(
                angle: i * math.pi / 2,
                child: Transform.translate(
                  offset: const Offset(0, -100),
                  child: Container(
                    width: 1,
                    height: 8,
                    color: AppColors.accentPrimary.withValues(alpha: 0.55),
                  ),
                ),
              ),
            _RingBorder(
              size: 140,
              color: AppColors.accentPrimary.withValues(alpha: 0.18),
              strokeWidth: 1,
            ),
            Transform.rotate(
              angle: _middle.value * 2 * math.pi,
              child: CustomPaint(
                size: const Size.square(140),
                painter: _ScanArcPainter(),
              ),
            ),
            Transform.rotate(
              angle: _inner.value * 2 * math.pi,
              child: CustomPaint(
                size: const Size.square(90),
                painter: _DashedRingPainter(
                  color: AppColors.accentSecondary.withValues(alpha: 0.5),
                  strokeWidth: 0.7,
                  dash: 2,
                  gap: 4,
                ),
              ),
            ),
            Transform.scale(
              scale: scale,
              child: SizedBox.square(
                dimension: 120,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.accentPrimary.withValues(alpha: coreGlow),
                        AppColors.accentPrimary.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Transform.scale(scale: scale, child: const _EmblemCore()),
          ],
        );
      },
    );
  }
}

class _RingBorder extends StatelessWidget {
  const _RingBorder({
    required this.size,
    required this.color,
    required this.strokeWidth,
  });

  final double size;
  final Color color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: color, width: strokeWidth),
        ),
      ),
    );
  }
}

class _EmblemCore extends StatelessWidget {
  const _EmblemCore();

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              boxShadow: [
                BoxShadow(
                  color: AppColors.accentPrimary.withValues(alpha: 0.7),
                  blurRadius: 12,
                ),
              ],
            ),
            child: ClipPath(
              clipper: const HexagonClipper(),
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.accentSecondary, AppColors.accentPrimary],
                  ),
                ),
                child: SizedBox.expand(),
              ),
            ),
          ),
          CustomPaint(
            size: const Size.square(56),
            painter: HexagonOutlinePainter(
              color: Colors.white.withValues(alpha: 0.25),
              strokeWidth: 0.8,
            ),
          ),
          Text(
            'UD',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
              color: AppColors.bgDeepest,
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedRingPainter extends CustomPainter {
  _DashedRingPainter({
    required this.color,
    required this.strokeWidth,
    required this.dash,
    required this.gap,
  });

  final Color color;
  final double strokeWidth;
  final double dash;
  final double gap;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    final radius = size.shortestSide / 2 - strokeWidth / 2;
    final center = Offset(size.width / 2, size.height / 2);
    final circumference = 2 * math.pi * radius;
    final segment = dash + gap;
    final count = (circumference / segment).floor();
    final dashAngle = dash / radius;
    final stepAngle = (2 * math.pi) / count;
    for (var i = 0; i < count; i++) {
      final start = i * stepAngle;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        dashAngle,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRingPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.dash != dash ||
        oldDelegate.gap != gap;
  }
}

class _ScanArcPainter extends CustomPainter {
  _ScanArcPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final radius = size.shortestSide / 2 - 1.1;
    final center = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCircle(center: center, radius: radius);
    final shader = SweepGradient(
      startAngle: 0,
      endAngle: 0.22 * 2 * math.pi,
      colors: [AppColors.accentPrimary, AppColors.accentPrimary.withValues(alpha: 0)],
    ).createShader(rect);
    final paint = Paint()
      ..shader = shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawArc(rect, 0, 0.22 * 2 * math.pi, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ScanArcPainter oldDelegate) => false;
}
