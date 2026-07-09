import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/colors.dart';
import '../../design_system/components/app_background.dart';
import '../../design_system/components/banner_page.dart';
import '../../design_system/components/page_scroll_view.dart';
import '../../design_system/components/tool_card.dart';
import '../../design_system/spacing.dart';

class ToolsHomeView extends StatelessWidget {
  const ToolsHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: AppBackground(
        child: BannerPage(
          bannerLabel: 'ESSI · Operations Bridge',
          builder: (context, ctrl) => PageScrollView(
            controller: ctrl,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ToolCard(
                  title: 'Asteroid Analyzer',
                  subtitle: 'Decode 9-digit asteroid IDs',
                  icon: Icons.fingerprint,
                  tint: AppColors.accentPrimary,
                  onTap: () => context.push('/tools/asteroid'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Fishing Map',
                  subtitle: '96 zones + 4 map rooms, depths & poles',
                  icon: Icons.set_meal_outlined,
                  tint: AppColors.accentSecondary,
                  onTap: () => context.push('/tools/fishing'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Mars Express',
                  subtitle: 'Live schedule + zone alerts',
                  icon: Icons.tram_outlined,
                  tint: AppColors.accentWarn,
                  onTap: () => context.push('/tools/mars-express'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Wallet Lookup',
                  subtitle: 'Find a wallet from a name, or vice versa',
                  icon: Icons.wallet,
                  tint: AppColors.accentSuccess,
                  onTap: () => context.push('/tools/wallet'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'System Scan',
                  subtitle: 'Live planet positions (network · JPL NASA)',
                  icon: Icons.radar,
                  tint: AppColors.accentDanger,
                  onTap: () => context.push('/tools/scan'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Discoveries',
                  subtitle: 'Find comets and asteroids by date (NASA SBDB)',
                  icon: Icons.travel_explore,
                  tint: AppColors.accentDanger,
                  onTap: () => context.push('/tools/discoveries'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Tracker',
                  subtitle: 'Track a comet or asteroid live (JPL Horizons)',
                  icon: Icons.gps_fixed,
                  tint: AppColors.accentPrimary,
                  onTap: () => context.push('/tools/tracker'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ToolCard(
                  title: 'Jobs',
                  subtitle: 'Search 371 jobs by faction, reward, skill, location',
                  icon: Icons.work_outline,
                  tint: AppColors.accentSecondary,
                  onTap: () => context.push('/tools/jobs'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
