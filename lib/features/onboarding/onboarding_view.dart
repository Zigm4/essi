import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/colors.dart';
import '../../design_system/components/app_background.dart';
import '../../design_system/components/glass_card.dart';
import '../../design_system/components/neon_button.dart';
import '../../design_system/spacing.dart';
import '../../design_system/typography.dart';
import '../../services/app_settings.dart';

/// First-run onboarding: three "incoming transmission" cards teaching what
/// Underdeck is, what the tools / SL-sectors mean, and the privacy promise.
///
/// Reached two ways:
/// - **First run** — the `/boot` screen navigates here with `context.go` when
///   `onboardingSeen == false`. Finishing here has nothing to pop back to, so
///   we `context.go('/tools')`.
/// - **Replay** — Settings pushes this route with `context.push`. Finishing
///   simply pops back to Settings.
///
/// Either way, finishing (Done or Skip) flips the persisted `onboardingSeen`
/// flag so the flow is shown exactly once automatically.
class OnboardingView extends ConsumerStatefulWidget {
  const OnboardingView({super.key});

  @override
  ConsumerState<OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends ConsumerState<OnboardingView> {
  final _controller = PageController();
  int _page = 0;

  static const _pages = <_OnboardingPageData>[
    _OnboardingPageData(
      channel: 'ESSI//WELCOME',
      icon: Icons.satellite_alt,
      title: 'What Underdeck is',
      body:
          'Underdeck is an unofficial fan companion for UP55 — a pocket ESSI '
          'terminal for pilots.\n\n'
          'It bundles the field tools, references and trackers you reach for '
          'mid-run into one offline-first console. No account, no sign-in — '
          'open it and it works.',
      bullets: [
        'Made by a player, for the UP55 community.',
        'Everything lives on-device and works offline.',
      ],
    ),
    _OnboardingPageData(
      channel: 'ESSI//TOOLKIT',
      icon: Icons.grid_view_rounded,
      title: 'The tools & SL-sectors',
      body:
          'The Tools deck holds the working kit — System Scan, Asteroid '
          'Analyzer, Mars Express alerts, the Fishing map and more. Captures, '
          'Hangar and the Knowledge core keep your notes and references close.\n\n'
          'The ESSI banner up top reads out an SL-sector code (SL = star-lane): '
          'a scroll-driven coordinate that anchors where you are in the console. '
          'It is flavour, not a live position — no location is ever read.',
      bullets: [
        'Sector codes are cosmetic — nothing is tracked from them.',
        'Tabs along the bottom switch between decks.',
      ],
    ),
    _OnboardingPageData(
      channel: 'ESSI//PRIVACY',
      icon: Icons.shield_moon,
      title: 'Privacy promise',
      body:
          'Underdeck has no backend operated by us and ships no telemetry or '
          'analytics SDK. Your data stays on your device.\n\n'
          'The only outbound network is opt-in (a Discord invite, System Scan, '
          'Discoveries, Tracker). You own your data: back it up or move devices '
          'with a plain JSON export from Settings.',
      bullets: [
        'No backend. No telemetry. No ads.',
        'Full JSON export & import lives in Settings › Data.',
      ],
    ),
  ];

  bool get _isLast => _page == _pages.length - 1;

  bool _reduceMotion(BuildContext context) {
    final reduce =
        ref.read(appSettingsProvider.select((s) => s.reduceAnimations));
    return reduce || MediaQuery.disableAnimationsOf(context);
  }

  void _goTo(int index) {
    if (_reduceMotion(context)) {
      _controller.jumpToPage(index);
    } else {
      _controller.animateToPage(
        index,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _next() {
    if (_isLast) {
      _finish();
    } else {
      _goTo(_page + 1);
    }
  }

  Future<void> _finish() async {
    await ref.read(appSettingsProvider.notifier).setOnboardingSeen(true);
    if (!mounted) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/tools');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: AppBackground(
        child: SafeArea(
          child: Column(
            children: [
              // Top bar: transmission tag + Skip.
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.sm,
                  0,
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.wifi_tethering,
                      color: AppColors.accentSuccess,
                      size: 14,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'INCOMING TRANSMISSION',
                      style: AppTypography.mono.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: AppColors.accentSecondary,
                      ),
                    ),
                    const Spacer(),
                    Semantics(
                      button: true,
                      label: 'Skip intro',
                      excludeSemantics: true,
                      child: TextButton(
                        onPressed: _finish,
                        child: Text(
                          'Skip',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: _pages.length,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemBuilder: (context, i) =>
                      _OnboardingPage(data: _pages[i]),
                ),
              ),
              // Dots.
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < _pages.length; i++)
                      _Dot(active: i == _page),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: NeonButton(
                    title: _isLast ? 'Enter Underdeck' : 'Next',
                    icon: _isLast ? Icons.rocket_launch : Icons.arrow_forward,
                    onPressed: _next,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingPageData {
  const _OnboardingPageData({
    required this.channel,
    required this.icon,
    required this.title,
    required this.body,
    required this.bullets,
  });

  final String channel;
  final IconData icon;
  final String title;
  final String body;
  final List<String> bullets;
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({required this.data});

  final _OnboardingPageData data;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: GlassCard(
        glow: true,
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(color: AppColors.borderGlow, width: 1),
                    color: AppColors.accentPrimary.withValues(alpha: 0.10),
                  ),
                  child: Icon(
                    data.icon,
                    color: AppColors.accentPrimary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    data.channel,
                    style: AppTypography.mono.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                      color: AppColors.accentSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(data.title, style: AppTypography.display),
            const SizedBox(height: AppSpacing.md),
            Text(
              data.body,
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(height: 1, color: AppColors.borderSubtle),
            const SizedBox(height: AppSpacing.md),
            for (final b in data.bullets) _Bullet(b),
          ],
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.chevron_right,
            color: AppColors.accentSuccess,
            size: 16,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(text, style: AppTypography.caption)),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: active ? 22 : 7,
      height: 7,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: active
            ? AppColors.accentPrimary
            : AppColors.textDim.withValues(alpha: 0.5),
      ),
    );
  }
}
