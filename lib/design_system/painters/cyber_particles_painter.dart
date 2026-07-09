import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../colors.dart';

class Particle {
  Particle({
    required this.x,
    required this.speed,
    required this.radius,
    required this.phase,
  });

  final double x;
  final double speed;
  final double radius;
  final double phase;
}

List<Particle> generateParticles({required int count, int? seed}) {
  final rng = seed != null ? math.Random(seed) : math.Random();
  return List.generate(
    count,
    (_) => Particle(
      x: rng.nextDouble(),
      speed: 0.18 + rng.nextDouble() * (0.55 - 0.18),
      radius: 0.6 + rng.nextDouble() * (2.4 - 0.6),
      phase: rng.nextDouble(),
    ),
  );
}

class CyberParticlesPainter extends CustomPainter {
  CyberParticlesPainter({
    required this.particles,
    required this.time,
  }) : super(repaint: time);

  final List<Particle> particles;

  /// Elapsed seconds, driven by the ticker via a [ValueListenable] so the
  /// painter repaints on tick without any per-frame `setState`/rebuild.
  final ValueListenable<double> time;

  @override
  void paint(Canvas canvas, Size size) {
    final timeSeconds = time.value;
    // One reusable Paint for all particles; only its color changes per particle.
    final paint = Paint();
    for (final p in particles) {
      final raw = (timeSeconds * p.speed + p.phase) % 1.0;
      final cycle = raw < 0 ? raw + 1.0 : raw;
      final y = size.height * (1.0 - cycle);
      final opacity = math.sin(cycle * math.pi);
      paint.color = AppColors.accentSecondary.withValues(alpha: 0.55 * opacity);
      canvas.drawCircle(Offset(p.x * size.width, y), p.radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CyberParticlesPainter oldDelegate) {
    return oldDelegate.time != time;
  }
}
