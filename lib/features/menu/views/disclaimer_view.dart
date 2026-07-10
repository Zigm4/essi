import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_constants.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';

class DisclaimerView extends StatelessWidget {
  const DisclaimerView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Disclaimer', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: PageScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: AppColors.accentPrimary,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Unofficial fan project',
                          style: AppTypography.headline,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Underdeck is an independent companion app made by a player for the UP55 community.',
                      style: AppTypography.body,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'It is not affiliated with, endorsed by, or sponsored by the creator of Underpunks55.',
                      style: AppTypography.body,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(title: 'Credits'),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      '${AppConstants.gameTitle} is created by ${AppConstants.gameCreator}.',
                      style: AppTypography.body,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'All in-game terminology, lore, zone names and bot commands referenced in this app belong to the original creators. Underdeck only mirrors information that is freely visible in the public Discord bot.',
                      style: AppTypography.body,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Community resources',
                      icon: Icons.menu_book,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'The Underpunks Fandom wiki is a community-maintained reference for UP55 lore, zones and game mechanics.',
                      style: AppTypography.body,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    GestureDetector(
                      onTap: () => launchUrl(
                        Uri.parse(AppConstants.fandomUrl),
                        mode: LaunchMode.externalApplication,
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.open_in_new,
                              color: AppColors.accentPrimary, size: 16),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            'underpunks.fandom.com',
                            style: AppTypography.mono.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.accentSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Map content & updates',
                      icon: Icons.public,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Interactive maps are downloaded from GitHub — GitHub '
                      'Pages (fronted by Fastly) for the version pointer and '
                      'jsDelivr (with raw.githubusercontent.com as a fallback) '
                      'for the files — at most once a day, and verified by '
                      'SHA-256 before use. A built-in sample map ships with the '
                      'app so maps work offline. Downloads are on by default '
                      'and can be turned off, or cleared, in Settings › '
                      'Interactive maps.',
                      style: AppTypography.body,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(title: 'Trademarks & assets'),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'The names "Underpunks55", "UP55", "East-Shire" and any related visual assets are the property of their respective owners. Underdeck uses no in-game art assets, only original UI elements built from scratch.',
                      style: AppTypography.body,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
