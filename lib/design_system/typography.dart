import 'package:flutter/widgets.dart';

import 'colors.dart';

class AppTypography {
  AppTypography._();

  // Font families bundled as assets (see pubspec.yaml `fonts:` and main()).
  // Using bundled families means nothing is fetched from fonts.gstatic.com at
  // runtime. Names must match the pubspec `family:` values exactly.
  static const String fontSans = 'Inter';
  static const String fontMono = 'JetBrainsMono';
  static const String fontRounded = 'Quicksand';

  // Computed once (lazily on first access) instead of re-running copyWith on
  // every access. These styles are constant for the app lifetime.
  static const TextStyle _sansBase = TextStyle(
    fontFamily: fontSans,
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );
  static const TextStyle _monoBase = TextStyle(
    fontFamily: fontMono,
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );
  static const TextStyle _roundedBase = TextStyle(
    fontFamily: fontRounded,
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );

  static final TextStyle display = _roundedBase.copyWith(
    fontSize: 34,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.1,
  );

  static final TextStyle title = _sansBase.copyWith(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static final TextStyle headline = _sansBase.copyWith(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static final TextStyle body = _sansBase.copyWith(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static final TextStyle caption = _sansBase.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static final TextStyle mono = _monoBase.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static final TextStyle terminal = _monoBase.copyWith(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.accentPrimary,
  );
}
