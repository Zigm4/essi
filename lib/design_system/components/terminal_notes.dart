import 'package:flutter/material.dart';

import '../colors.dart';
import '../spacing.dart';
import '../typography.dart';
import 'animated_primitives.dart';
import 'glass_card.dart';

/// Terminal-style notes card with an indexed list of one-liners and a
/// blinking-cursor "more notes pending" line at the end.
///
/// Used everywhere a `> namespace.notes` block is shown (hangar, asteroid
/// analyzer, …). Mirrors the iOS Swift reference.
class TerminalNotes extends StatelessWidget {
  const TerminalNotes({
    super.key,
    required this.title,
    required this.lines,
  });

  /// The bracketed terminal title, without the leading "> ".
  /// e.g. `hangar.notes` will render as `> hangar.notes`.
  final String title;

  /// Each line is rendered with a zero-padded `[NN]` index (01, 02, …).
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('> $title', style: AppTypography.terminal),
              const Spacer(),
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.accentSuccess,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            height: 1,
            color: AppColors.borderSubtle.withValues(alpha: 0.4),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < lines.length; i++) ...[
            _TerminalLine(
              index: (i + 1).toString().padLeft(2, '0'),
              text: lines[i],
            ),
            if (i < lines.length - 1) const SizedBox(height: 4),
          ],
          const SizedBox(height: 4),
          // Trailing "[NN] ▋" line suggests "more notes pending".
          _PendingTerminalLine(index: (lines.length + 1).toString().padLeft(2, '0')),
        ],
      ),
    );
  }
}

class _TerminalLine extends StatelessWidget {
  const _TerminalLine({required this.index, required this.text});
  final String index;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 28,
          child: Text(
            '[$index]',
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.accentPrimary,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _PendingTerminalLine extends StatelessWidget {
  const _PendingTerminalLine({required this.index});
  final String index;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Text(
              '[$index]',
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.accentPrimary.withValues(alpha: 0.55),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const BlinkingCursor(),
        ],
      ),
    );
  }
}
