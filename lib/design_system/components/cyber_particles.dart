import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/app_settings.dart';
import '../painters/cyber_particles_painter.dart';

class CyberParticles extends ConsumerStatefulWidget {
  const CyberParticles({super.key, this.count = 28});

  final int count;

  @override
  ConsumerState<CyberParticles> createState() => _CyberParticlesState();
}

class _CyberParticlesState extends ConsumerState<CyberParticles>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  late final List<Particle> _particles;
  final ValueNotifier<double> _seconds = ValueNotifier<double>(0);

  @override
  void initState() {
    super.initState();
    _particles = generateParticles(count: widget.count);
    // Drive elapsed time through a ValueNotifier the painter listens to, so the
    // ticker never triggers a widget rebuild — only the isolated painter repaints.
    _ticker = createTicker((elapsed) {
      _seconds.value = elapsed.inMicroseconds / 1e6;
    });
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _seconds.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = ref.watch(
      appSettingsProvider.select((s) => s.reduceAnimations),
    );
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    if (reduce || mqReduce) return const SizedBox.shrink();
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: CyberParticlesPainter(
            particles: _particles,
            time: _seconds,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}
