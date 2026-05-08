import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/haptics.dart';
import '../colors.dart';
import '../spacing.dart';
import '../typography.dart';
import 'glass_card.dart';

class ToolCard extends ConsumerWidget {
  const ToolCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.tint,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;

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
              width: 44,
              height: 44,
              child: Icon(icon, color: tint, size: 28),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.headline),
                  const SizedBox(height: 4),
                  Text(subtitle, style: AppTypography.caption),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: AppColors.textDim,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
