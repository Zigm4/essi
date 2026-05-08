import 'package:flutter/material.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../domain/captures_models.dart';
import 'tag_chip.dart';

class LinkCard extends StatelessWidget {
  const LinkCard({super.key, required this.link});

  final LinkModel link;

  @override
  Widget build(BuildContext context) {
    final isDiscord = link.url.contains('discord');
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                isDiscord ? Icons.forum_outlined : Icons.link,
                color: AppColors.accentPrimary,
                size: 18,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      link.title.isNotEmpty ? link.title : link.url,
                      style: AppTypography.headline,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      link.url,
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (link.note.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              link.note,
              style: AppTypography.body.copyWith(color: AppColors.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (link.tags.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final t in link.tags) ...[
                    TagChip(label: t.displayName),
                    const SizedBox(width: 4),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
