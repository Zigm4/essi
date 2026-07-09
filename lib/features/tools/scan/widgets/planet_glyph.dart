import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../services/app_settings.dart';

enum PlanetKind {
  mercury,
  venus,
  earth,
  mars,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto,
}

extension PlanetKindX on PlanetKind {
  static PlanetKind fromName(String name) {
    return PlanetKind.values.firstWhere(
      (k) => k.name == name.toLowerCase(),
      orElse: () => PlanetKind.pluto,
    );
  }

  double get diameter {
    switch (this) {
      case PlanetKind.mercury:
        return 11;
      case PlanetKind.venus:
        return 18;
      case PlanetKind.earth:
        return 18;
      case PlanetKind.mars:
        return 14;
      case PlanetKind.jupiter:
        return 26;
      case PlanetKind.saturn:
        return 22;
      case PlanetKind.uranus:
        return 19;
      case PlanetKind.neptune:
        return 19;
      case PlanetKind.pluto:
        return 10;
    }
  }

  Color get lightColor {
    switch (this) {
      case PlanetKind.mercury:
        return const Color(0xFFC8B594);
      case PlanetKind.venus:
        return const Color(0xFFF0C988);
      case PlanetKind.earth:
        return const Color(0xFF6CB4F7);
      case PlanetKind.mars:
        return const Color(0xFFE8745A);
      case PlanetKind.jupiter:
        return const Color(0xFFE8B270);
      case PlanetKind.saturn:
        return const Color(0xFFF0DA9C);
      case PlanetKind.uranus:
        return const Color(0xFF9CEBE0);
      case PlanetKind.neptune:
        return const Color(0xFF6F88F0);
      case PlanetKind.pluto:
        return const Color(0xFFC2A8C4);
    }
  }

  Color get darkColor {
    switch (this) {
      case PlanetKind.mercury:
        return const Color(0xFF6F5F44);
      case PlanetKind.venus:
        return const Color(0xFF9C6E2F);
      case PlanetKind.earth:
        return const Color(0xFF2C5990);
      case PlanetKind.mars:
        return const Color(0xFF8C2E1A);
      case PlanetKind.jupiter:
        return const Color(0xFF8E5826);
      case PlanetKind.saturn:
        return const Color(0xFF9C7E36);
      case PlanetKind.uranus:
        return const Color(0xFF3F8478);
      case PlanetKind.neptune:
        return const Color(0xFF2C3FA2);
      case PlanetKind.pluto:
        return const Color(0xFF694E6B);
    }
  }

  Color get scanColor {
    switch (this) {
      case PlanetKind.mercury:
      case PlanetKind.venus:
      case PlanetKind.saturn:
      case PlanetKind.pluto:
        return AppColors.accentSecondary;
      case PlanetKind.earth:
      case PlanetKind.neptune:
      case PlanetKind.uranus:
        return const Color(0xFF9DDCFF);
      case PlanetKind.mars:
        return const Color(0xFFFFB0A0);
      case PlanetKind.jupiter:
        return const Color(0xFFFFD79A);
    }
  }

  bool get hasRing => this == PlanetKind.saturn;

  double get phaseOffset {
    final order = PlanetKind.values.indexOf(this);
    return order * 0.41;
  }
}

class PlanetGlyph extends ConsumerWidget {
  const PlanetGlyph({super.key, required this.kind, this.staticOnly = false});

  final PlanetKind kind;
  final bool staticOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reduce = ref.watch(
      appSettingsProvider.select((s) => s.reduceAnimations),
    );
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    final skip = staticOnly || reduce || mqReduce;
    return SizedBox(
      width: 32,
      height: 32,
      child: skip ? _StaticPlanet(kind: kind) : _AnimatedPlanet(kind: kind),
    );
  }
}

class _StaticPlanet extends StatelessWidget {
  const _StaticPlanet({required this.kind});
  final PlanetKind kind;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: _PlanetPainter(kind: kind, animated: false),
      ),
    );
  }
}

class _AnimatedPlanet extends StatefulWidget {
  const _AnimatedPlanet({required this.kind});
  final PlanetKind kind;

  @override
  State<_AnimatedPlanet> createState() => _AnimatedPlanetState();
}

class _AnimatedPlanetState extends State<_AnimatedPlanet>
    with TickerProviderStateMixin {
  late final AnimationController _halo = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat(reverse: true);
  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4500),
  )..repeat();

  @override
  void dispose() {
    _halo.dispose();
    _scan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // No AnimatedBuilder: the painter repaints directly off the controllers via
    // `repaint:`, and RepaintBoundary keeps those repaints off the row/list.
    return RepaintBoundary(
      child: CustomPaint(
        painter: _PlanetPainter(
          kind: widget.kind,
          animated: true,
          halo: _halo,
          scan: _scan,
        ),
      ),
    );
  }
}

class _PlanetPainter extends CustomPainter {
  _PlanetPainter({
    required this.kind,
    required this.animated,
    this.halo,
    this.scan,
  }) : super(
          repaint: animated ? Listenable.merge([halo, scan]) : null,
        );

  final PlanetKind kind;
  final bool animated;
  final Animation<double>? halo;
  final Animation<double>? scan;

  @override
  void paint(Canvas canvas, Size size) {
    final haloPhase = animated ? Curves.easeInOut.transform(halo!.value) : 0.5;
    final scanPhase = animated ? scan!.value : 0.0;
    final center = Offset(size.width / 2, size.height / 2);
    final diameter = kind.diameter;
    final radius = diameter / 2;

    // Halo
    final haloRadius = 16.0;
    final haloScale = animated ? (0.85 + 0.15 * haloPhase) : 1.0;
    final haloOpacity = animated ? (0.55 + 0.45 * (1 - haloPhase)) : 0.55;
    final haloPaint = Paint()
      ..shader = ui.Gradient.radial(
        center,
        haloRadius * haloScale,
        [
          kind.lightColor.withValues(alpha: 0.55 * haloOpacity),
          kind.lightColor.withValues(alpha: 0),
        ],
        [0.0, 1.0],
      );
    canvas.drawCircle(center, haloRadius * haloScale, haloPaint);

    // Body
    final bodyRect = Rect.fromCircle(center: center, radius: radius);
    final bodyPaint = Paint()
      ..shader = ui.Gradient.linear(
        bodyRect.topLeft,
        bodyRect.bottomRight,
        [kind.lightColor, kind.darkColor],
      );
    canvas.drawCircle(center, radius, bodyPaint);

    // Body shadow glow
    final glowPaint = Paint()
      ..color = kind.lightColor.withValues(alpha: 0.55)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2);
    canvas.drawCircle(center, radius, glowPaint);

    // Body border
    final borderPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.22)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, radius, borderPaint);

    // Saturn ring
    if (kind.hasRing) {
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(-22 * math.pi / 180);
      final ringW = diameter * 1.85;
      final ringH = diameter * 0.5;
      final ringRect = Rect.fromCenter(center: Offset.zero, width: ringW, height: ringH);
      canvas.drawOval(
        ringRect,
        Paint()
          ..color = kind.lightColor.withValues(alpha: 0.5)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5,
      );
      canvas.drawOval(
        ringRect,
        Paint()
          ..color = kind.darkColor.withValues(alpha: 0.9)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
      canvas.restore();
    }

    // Scan arc
    if (animated) {
      final arcRadius = (diameter + 5) / 2;
      final arcRect = Rect.fromCircle(center: center, radius: arcRadius);
      final phaseShift = kind.phaseOffset * 90 * math.pi / 180;
      final rotation = scanPhase * 2 * math.pi;
      final startAngle = rotation + phaseShift - math.pi / 2;
      final sweepAngle = 0.18 * 2 * math.pi;
      final arcPaint = Paint()
        ..color = kind.scanColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5);
      canvas.drawArc(arcRect, startAngle, sweepAngle, false, arcPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _PlanetPainter oldDelegate) {
    // Animated repaints are driven by `repaint:`; this only guards rebuilds that
    // swap the painter (e.g. kind changes or animated/static toggles).
    return oldDelegate.kind != kind ||
        oldDelegate.animated != animated ||
        oldDelegate.halo != halo ||
        oldDelegate.scan != scan;
  }
}
