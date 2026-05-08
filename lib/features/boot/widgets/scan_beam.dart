import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../services/app_settings.dart';

class ScanBeam extends ConsumerWidget {
  const ScanBeam({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reduce = ref.watch(
      appSettingsProvider.select((s) => s.reduceAnimations),
    );
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    if (reduce || mqReduce) return const SizedBox.shrink();
    return const _AnimatedScanBeam();
  }
}

class _AnimatedScanBeam extends StatefulWidget {
  const _AnimatedScanBeam();

  @override
  State<_AnimatedScanBeam> createState() => _AnimatedScanBeamState();
}

class _AnimatedScanBeamState extends State<_AnimatedScanBeam>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4500),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return AnimatedBuilder(
            animation: _ctrl,
            builder: (context, _) {
              final t = Curves.easeInOut.transform(_ctrl.value);
              final dy = -45 + t * (constraints.maxHeight + 90);
              return Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: dy,
                    child: Container(
                      height: 90,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            AppColors.accentPrimary.withValues(alpha: 0.18),
                            AppColors.accentPrimary.withValues(alpha: 0.32),
                            AppColors.accentPrimary.withValues(alpha: 0.18),
                            Colors.transparent,
                          ],
                        ),
                        backgroundBlendMode: BlendMode.screen,
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
