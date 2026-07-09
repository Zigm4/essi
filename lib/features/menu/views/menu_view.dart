import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_constants.dart';
import '../../../core/app_version.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/banner_page.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';

class MenuView extends ConsumerWidget {
  const MenuView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final version =
        ref.watch(appVersionProvider).valueOrNull ?? AppVersion.fallback;
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: AppBackground(
        child: BannerPage(
          bannerLabel: 'ESSI · Operator Support',
          builder: (context, ctrl) => PageScrollView(
            controller: ctrl,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              _MenuRow(
                title: 'Settings',
                subtitle: 'Animations · haptics',
                icon: Icons.tune,
                onTap: () => context.push('/menu/settings'),
              ),
              const SizedBox(height: AppSpacing.md),
              _MenuRow(
                title: 'FAQ',
                subtitle: 'Free, local, private, the rules.',
                icon: Icons.help_outline,
                onTap: () => context.push('/menu/faq'),
              ),
              const SizedBox(height: AppSpacing.md),
              _MenuRow(
                title: 'Contact',
                subtitle: 'Feedback, bug reports, support',
                icon: Icons.mail_outline,
                onTap: () => context.push('/menu/contact'),
              ),
              const SizedBox(height: AppSpacing.md),
              _MenuRow(
                title: 'Join Discord',
                subtitle: 'UP55 community invite',
                icon: Icons.forum,
                external: true,
                onTap: () async {
                  Haptics.of(ref).tap();
                  await launchUrl(
                    Uri.parse(AppConstants.discordInviteUrl),
                    mode: LaunchMode.externalApplication,
                  );
                },
              ),
              const SizedBox(height: AppSpacing.md),
              _MenuRow(
                title: 'Disclaimer',
                subtitle: 'Unofficial fan project · made for the UP55 community',
                icon: Icons.info_outline,
                onTap: () => context.push('/menu/disclaimer'),
              ),
              const SizedBox(height: AppSpacing.md),
              _MenuRow(
                title: 'About',
                subtitle: '${version.shortLabel} (Alpha)',
                icon: Icons.auto_awesome,
                onTap: () => context.push('/menu/about'),
              ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MenuRow extends ConsumerWidget {
  const _MenuRow({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.external = false,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final bool external;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Haptics.of(ref).tap();
        onTap();
      },
      child: GlassCard(
        child: Row(
          children: [
            SizedBox(
              width: 36,
              height: 36,
              child: Icon(icon, color: AppColors.accentPrimary, size: 22),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.headline),
                  const SizedBox(height: 2),
                  Text(subtitle, style: AppTypography.caption),
                ],
              ),
            ),
            Icon(
              external ? Icons.open_in_new : Icons.chevron_right,
              color: AppColors.textDim,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
