import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/haptics.dart';
import '../colors.dart';
import '../spacing.dart';
import '../typography.dart';

/// Lightweight container used by the "How it works" sheets. No blur, just a
/// solid `bgGlass` fill + a subtle border. Cheap to stack many times.
class InfoCard extends StatelessWidget {
  const InfoCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: child,
    );
  }
}

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

class KvRow extends StatelessWidget {
  const KvRow({
    super.key,
    required this.label,
    required this.value,
    this.labelWidth = 110,
  });

  final String label;
  final String value;
  final double labelWidth;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: labelWidth,
            child: Text(
              label,
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
              value,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ParamRow extends StatelessWidget {
  const ParamRow({
    super.key,
    required this.name,
    required this.value,
    required this.note,
  });

  final String name;
  final String value;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            children: [
              Text(
                name,
                style: AppTypography.mono.copyWith(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentSecondary,
                ),
              ),
              Text(
                value,
                style: AppTypography.mono.copyWith(
                  fontSize: 11,
                  color: AppColors.accentPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            note,
            style: AppTypography.body.copyWith(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class StepRow extends StatelessWidget {
  const StepRow({
    super.key,
    required this.number,
    required this.title,
    required this.body,
  });

  final String number;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: Text(
              number,
              style: AppTypography.mono.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.accentPrimary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.mono.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  body,
                  style: AppTypography.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class TierRow extends StatelessWidget {
  const TierRow({
    super.key,
    required this.tier,
    required this.title,
    required this.body,
  });

  final String tier;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.accentPrimary.withValues(alpha: 0.6),
                width: 0.7,
              ),
            ),
            child: Text(
              tier,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.accentPrimary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.mono.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  body,
                  style: AppTypography.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class QuirkRow extends StatelessWidget {
  const QuirkRow({super.key, required this.title, required this.detail});

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(
              Icons.warning_amber_rounded,
              size: 14,
              color: AppColors.accentWarn,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.mono.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentWarn,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: AppTypography.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WindowRow extends StatelessWidget {
  const WindowRow({
    super.key,
    required this.planet,
    required this.broad,
    required this.refine,
  });

  final String planet;
  final String broad;
  final String refine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            planet,
            style: AppTypography.mono.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.accentSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Coarse',
                      style: AppTypography.mono.copyWith(
                        fontSize: 9,
                        color: AppColors.textDim,
                      ),
                    ),
                    Text(
                      broad,
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Refine',
                      style: AppTypography.mono.copyWith(
                        fontSize: 9,
                        color: AppColors.textDim,
                      ),
                    ),
                    Text(
                      refine,
                      style: AppTypography.mono.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class OpRow extends StatelessWidget {
  const OpRow({super.key, required this.op, required this.desc});

  final String op;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 70,
            child: Text(
              op,
              style: AppTypography.mono.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.accentSecondary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              desc,
              style: AppTypography.body.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class StatusRow extends StatelessWidget {
  const StatusRow({
    super.key,
    required this.icon,
    required this.title,
    required this.rule,
  });

  final String icon;
  final String title;
  final String rule;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Text(icon, style: const TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.mono.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  rule,
                  style: AppTypography.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Standard scaffold for any "How it works" sheet (close button + scrollable
/// body with the AppBackground).
class HowItWorksSheet extends StatelessWidget {
  const HowItWorksSheet({super.key, required this.cards});

  final List<Widget> cards;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.97,
      expand: false,
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
          child: Scaffold(
            backgroundColor: AppColors.bgDeepest,
            extendBodyBehindAppBar: true,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  'Close',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              leadingWidth: 80,
              title: Text('How it works', style: AppTypography.headline),
              centerTitle: true,
            ),
            body: Container(
              color: AppColors.bgDeepest,
              child: ListView(
                controller: scrollController,
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  MediaQuery.paddingOf(context).top +
                      kToolbarHeight +
                      AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.xxl,
                ),
                children: [
                  for (var i = 0; i < cards.length; i++) ...[
                    cards[i],
                    if (i < cards.length - 1)
                      const SizedBox(height: AppSpacing.lg),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
