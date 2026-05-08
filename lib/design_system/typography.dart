import 'package:flutter/widgets.dart';
import 'package:google_fonts/google_fonts.dart';

import 'colors.dart';

class AppTypography {
  AppTypography._();

  static TextStyle get _sansBase => GoogleFonts.inter(
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );
  static TextStyle get _monoBase => GoogleFonts.jetBrainsMono(
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );
  static TextStyle get _roundedBase => GoogleFonts.quicksand(
    decoration: TextDecoration.none,
    decorationColor: AppColors.textPrimary,
  );

  static TextStyle get display => _roundedBase.copyWith(
    fontSize: 34,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.1,
  );

  static TextStyle get title => _sansBase.copyWith(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static TextStyle get headline => _sansBase.copyWith(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static TextStyle get body => _sansBase.copyWith(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static TextStyle get caption => _sansBase.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static TextStyle get mono => _monoBase.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static TextStyle get terminal => _monoBase.copyWith(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.accentPrimary,
  );
}
