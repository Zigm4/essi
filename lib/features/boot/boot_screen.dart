import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../design_system/colors.dart';
import '../../design_system/components/app_background.dart';
import '../../design_system/components/boot_terminal_text.dart';
import '../../design_system/spacing.dart';
import '../../design_system/typography.dart';
import '../../services/app_settings.dart';
import 'widgets/boot_emblem.dart';
import 'widgets/scan_beam.dart';

class BootScreen extends ConsumerStatefulWidget {
  const BootScreen({super.key, required this.onComplete});

  final VoidCallback onComplete;

  static const _bootLines = [
    '> initializing ESSI subsystems…',
    '> linking local datastore…',
    '> indexing knowledge core…',
    '> calibrating ESSI scanners…',
    '> verifying drive nodes…',
    '> loading hangar registry…',
    '> spooling cargo manifest…',
    '> mounting Rankle River grid…',
    '> syncing pilot codex…',
    '> ready.',
  ];

  @override
  ConsumerState<BootScreen> createState() => _BootScreenState();
}

class _BootScreenState extends ConsumerState<BootScreen> {
  bool _exiting = false;
  bool _bootDone = false;

  void _onBootDone() {
    _bootDone = true;
    Future<void>.delayed(const Duration(milliseconds: 1600), _beginExit);
  }

  void _beginExit() {
    if (!mounted || _exiting) return;
    setState(() => _exiting = true);
  }

  void _onSkip() {
    if (_bootDone) {
      _beginExit();
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduce = ref.watch(
      appSettingsProvider.select((s) => s.reduceAnimations),
    );
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    final skip = reduce || mqReduce;
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _onSkip,
        child: AnimatedOpacity(
          opacity: _exiting ? 0 : 1,
          duration: const Duration(milliseconds: 550),
          curve: Curves.easeOut,
          onEnd: () {
            if (_exiting) widget.onComplete();
          },
          child: AppBackground(
            showsParticles: !skip,
            child: Stack(
              children: [
                const Positioned.fill(child: ScanBeam()),
                SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.max,
                    children: [
                      const SizedBox(height: AppSpacing.xxl),
                      const BootEmblem(),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'UNDERDECK',
                        style: GoogleFonts.quicksand(
                          fontSize: 38,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 6,
                          color: AppColors.textPrimary,
                          decoration: TextDecoration.none,
                          shadows: [
                            Shadow(
                              color: AppColors.accentPrimary.withValues(alpha: 0.55),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'UP55 FAN COMPANION',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 4,
                          color: AppColors.accentSecondary,
                          decoration: TextDecoration.none,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.xl,
                          0,
                          AppSpacing.xl,
                          AppSpacing.xxl,
                        ),
                        child: _BootTerminalCard(
                          lines: BootScreen._bootLines,
                          onComplete: _onBootDone,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: AnimatedOpacity(
                          opacity: _bootDone && !_exiting ? 0.7 : 0,
                          duration: const Duration(milliseconds: 220),
                          child: Text(
                            'tap to continue',
                            style: AppTypography.caption.copyWith(
                              fontSize: 10,
                              letterSpacing: 3,
                              color: AppColors.accentSecondary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BootTerminalCard extends StatelessWidget {
  const _BootTerminalCard({required this.lines, required this.onComplete});

  final List<String> lines;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
        boxShadow: [
          BoxShadow(
            color: AppColors.accentPrimary.withValues(alpha: 0.18),
            blurRadius: 14,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _Dot(color: Color(0xFFFF5F57)),
              const SizedBox(width: 6),
              const _Dot(color: Color(0xFFFEBC2E)),
              const SizedBox(width: 6),
              const _Dot(color: Color(0xFF28C840)),
              const Spacer(),
              Text(
                'essi://boot',
                style: AppTypography.mono.copyWith(
                  fontSize: 10,
                  color: AppColors.textDim,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          BootTerminalText(lines: lines, onComplete: onComplete),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
