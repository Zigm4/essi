import 'package:flutter/material.dart';

import '../../colors.dart';
import '../../spacing.dart';
import '../../typography.dart';

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
