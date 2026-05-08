import 'package:flutter/material.dart';

import '../../../core/relative_date.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../domain/captures_models.dart';
import 'tag_chip.dart';

class NoteCard extends StatelessWidget {
  const NoteCard({super.key, required this.note});

  final NoteModel note;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (note.title.isNotEmpty)
            Text(
              note.title,
              style: AppTypography.headline,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          if (note.body.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              note.body,
              style: AppTypography.body,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text(formatRelativeDate(note.updatedAt), style: AppTypography.caption),
              const Spacer(),
              if (note.tags.isNotEmpty)
                Flexible(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    reverse: true,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        for (final t in note.tags) ...[
                          TagChip(label: t.displayName),
                          const SizedBox(width: 4),
                        ],
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
