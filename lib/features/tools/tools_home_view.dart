import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/colors.dart';
import '../../design_system/components/app_background.dart';
import '../../design_system/components/page_scroll_view.dart';
import '../../design_system/components/tool_card.dart';
import '../../design_system/components/transmission_header.dart';
import '../../design_system/spacing.dart';
import '../../design_system/typography.dart';

class ToolsHomeView extends StatelessWidget {
  const ToolsHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('Tools', style: AppTypography.headline),
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
              const TransmissionHeader(label: 'ESSI · operations bridge'),
              const SizedBox(height: AppSpacing.lg),
              ToolCard(
                title: 'System Scan',
                subtitle: 'Live planet positions (network · JPL NASA)',
                icon: Icons.center_focus_strong,
                tint: AppColors.accentDanger,
                onTap: () => context.push('/tools/scan'),
              ),
              const SizedBox(height: AppSpacing.sm),
              ToolCard(
                title: 'Asteroid Analyzer',
                subtitle: 'Decode 9-digit asteroid IDs',
                icon: Icons.hexagon_outlined,
                tint: AppColors.accentPrimary,
                onTap: () => context.push('/tools/asteroid'),
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
                title: 'Fishing Map',
                subtitle: '96 zones + 4 map rooms, depths & poles',
                icon: Icons.set_meal_outlined,
                tint: AppColors.accentSecondary,
                onTap: () => context.push('/tools/fishing'),
              ),
              const SizedBox(height: AppSpacing.sm),
              ToolCard(
                title: 'Mars Express',
                subtitle: 'Live schedule (notifications coming soon)',
                icon: Icons.tram_outlined,
                tint: AppColors.accentWarn,
                onTap: () => context.push('/tools/mars-express'),
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
            ],
          ),
        ),
      ),
    );
  }
}

// _ComingSoon retained for future placeholders.
// ignore: unused_element
class _ComingSoon extends StatelessWidget {
  const _ComingSoon({
    required this.title,
    required this.subtitle,
    required this.icon,
  });
  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.4,
      child: ToolCard(
        title: title,
        subtitle: '$subtitle · coming soon',
        icon: icon,
        tint: AppColors.textSecondary,
        onTap: () {},
      ),
    );
  }
}
