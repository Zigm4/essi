import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/app_settings.dart';
import '../colors.dart';
import '../typography.dart';

bool _shouldSkipMotion(BuildContext context, WidgetRef ref) {
  final reduce = ref.watch(appSettingsProvider.select((s) => s.reduceAnimations));
  final mqReduce = MediaQuery.disableAnimationsOf(context);
  return reduce || mqReduce;
}

class PulsingDot extends ConsumerWidget {
  const PulsingDot({super.key, required this.color, this.size = 6});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skip = _shouldSkipMotion(context, ref);
    if (skip) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
    }
    return _AnimatedPulsingDot(color: color, size: size);
  }
}

class _AnimatedPulsingDot extends StatefulWidget {
  const _AnimatedPulsingDot({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  State<_AnimatedPulsingDot> createState() => _AnimatedPulsingDotState();
}

class _AnimatedPulsingDotState extends State<_AnimatedPulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_ctrl.value);
        return Opacity(
          opacity: 0.35 + (1.0 - 0.35) * t,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
          ),
        );
      },
    );
  }
}

class BlinkingCursor extends ConsumerWidget {
  const BlinkingCursor({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skip = _shouldSkipMotion(context, ref);
    if (skip) return Text('▋', style: AppTypography.terminal);
    return const _AnimatedBlinkingCursor();
  }
}

class _AnimatedBlinkingCursor extends StatefulWidget {
  const _AnimatedBlinkingCursor();

  @override
  State<_AnimatedBlinkingCursor> createState() =>
      _AnimatedBlinkingCursorState();
}

class _AnimatedBlinkingCursorState extends State<_AnimatedBlinkingCursor>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_ctrl.value);
        return Opacity(
          opacity: t,
          child: Text('▋', style: AppTypography.terminal),
        );
      },
    );
  }
}

class PulsingGlow extends ConsumerWidget {
  const PulsingGlow({
    super.key,
    required this.child,
    this.color = AppColors.accentPrimary,
    this.borderRadius,
  });

  final Widget child;
  final Color color;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skip = _shouldSkipMotion(context, ref);
    if (skip) {
      return DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          boxShadow: [
            BoxShadow(color: color.withValues(alpha: 0.45), blurRadius: 6),
          ],
        ),
        child: child,
      );
    }
    return _AnimatedPulsingGlow(
      color: color,
      borderRadius: borderRadius,
      child: child,
    );
  }
}

class _AnimatedPulsingGlow extends StatefulWidget {
  const _AnimatedPulsingGlow({
    required this.child,
    required this.color,
    this.borderRadius,
  });
  final Widget child;
  final Color color;
  final BorderRadius? borderRadius;

  @override
  State<_AnimatedPulsingGlow> createState() => _AnimatedPulsingGlowState();
}

class _AnimatedPulsingGlowState extends State<_AnimatedPulsingGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_ctrl.value);
        final opacity = 0.2 + (0.7 - 0.2) * t;
        final radius = 4.0 + (10.0 - 4.0) * t;
        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius,
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: opacity),
                blurRadius: radius,
              ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class PulsingScale extends ConsumerWidget {
  const PulsingScale({
    super.key,
    required this.child,
    required this.color,
  });

  final Widget child;
  final Color color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skip = _shouldSkipMotion(context, ref);
    if (skip) {
      return DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 2),
          ],
        ),
        child: child,
      );
    }
    return _AnimatedPulsingScale(color: color, child: child);
  }
}

class _AnimatedPulsingScale extends StatefulWidget {
  const _AnimatedPulsingScale({required this.child, required this.color});
  final Widget child;
  final Color color;

  @override
  State<_AnimatedPulsingScale> createState() => _AnimatedPulsingScaleState();
}

class _AnimatedPulsingScaleState extends State<_AnimatedPulsingScale>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_ctrl.value);
        final scale = 1.0 + (1.15 - 1.0) * t;
        final opacity = 0.2 + (0.6 - 0.2) * t;
        final blur = 2.0 + (6.0 - 2.0) * t;
        return Transform.scale(
          scale: scale,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: widget.color.withValues(alpha: opacity),
                  blurRadius: blur,
                ),
              ],
            ),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}

class ConsoleReveal extends ConsumerStatefulWidget {
  const ConsoleReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.glitch = false,
  });

  final Widget child;
  final Duration delay;
  final bool glitch;

  @override
  ConsumerState<ConsoleReveal> createState() => _ConsoleRevealState();
}

class _ConsoleRevealState extends ConsumerState<ConsoleReveal> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final skip = !mounted ? true : _shouldSkipMotion(context, ref);
      if (skip) {
        if (mounted) setState(() => _visible = true);
        return;
      }
      await Future<void>.delayed(widget.delay);
      if (widget.glitch) {
        await Future<void>.delayed(const Duration(milliseconds: 60));
      }
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final skip = _shouldSkipMotion(context, ref);
    final visible = skip || _visible;
    return AnimatedSlide(
      offset: visible ? Offset.zero : const Offset(0, 0.05),
      duration: Duration(milliseconds: widget.glitch ? 180 : 220),
      curve: Curves.easeOut,
      child: AnimatedOpacity(
        opacity: visible ? 1.0 : 0.0,
        duration: Duration(milliseconds: widget.glitch ? 180 : 220),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
