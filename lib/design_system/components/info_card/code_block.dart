import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/haptics.dart';
import '../../colors.dart';
import '../../spacing.dart';
import '../../typography.dart';

/// Horizontally scrollable monospaced text with a copy button pinned in the
/// top-right. Tap copies the raw `text` to the clipboard.
class CodeBlock extends ConsumerStatefulWidget {
  const CodeBlock({super.key, required this.text});

  final String text;

  @override
  ConsumerState<CodeBlock> createState() => _CodeBlockState();
}

class _CodeBlockState extends ConsumerState<CodeBlock> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.text));
    if (!mounted) return;
    Haptics.of(ref).success();
    setState(() => _copied = true);
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.topRight,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgDeepest.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(color: AppColors.borderSubtle, width: 1),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.sm,
              AppSpacing.sm,
              40,
              AppSpacing.sm,
            ),
            child: Text(
              widget.text,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.accentSecondary,
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(6),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _copy,
            child: Container(
              width: 28,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.bgDeepest,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(color: AppColors.borderSubtle, width: 1),
              ),
              child: Icon(
                _copied ? Icons.check : Icons.copy,
                size: 11,
                color: _copied
                    ? AppColors.accentSuccess
                    : AppColors.accentPrimary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
