import 'package:flutter/material.dart';

import '../design_system/colors.dart';
import '../design_system/typography.dart';

ThemeData buildAppTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bgDeepest,
    colorScheme: base.colorScheme.copyWith(
      surface: AppColors.bgDeepest,
      primary: AppColors.accentPrimary,
      secondary: AppColors.accentSecondary,
      error: AppColors.accentDanger,
      onSurface: AppColors.textPrimary,
    ),
    textTheme: base.textTheme.copyWith(
      displayLarge: AppTypography.display,
      displayMedium: AppTypography.title,
      titleLarge: AppTypography.title,
      titleMedium: AppTypography.headline,
      bodyLarge: AppTypography.body,
      bodyMedium: AppTypography.body,
      labelMedium: AppTypography.caption,
      labelSmall: AppTypography.caption,
    ),
    iconTheme: const IconThemeData(color: AppColors.textPrimary),
    splashColor: AppColors.accentPrimary.withValues(alpha: 0.08),
    highlightColor: AppColors.accentPrimary.withValues(alpha: 0.04),
  );
}
