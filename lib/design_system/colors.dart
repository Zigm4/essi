import 'package:flutter/widgets.dart';

class AppColors {
  AppColors._();

  static const Color bgDeepest = Color(0xFF03060B);
  static const Color bgElevated = Color(0xFF0A1220);
  static Color get bgGlass => const Color(0xFF0F1C30).withValues(alpha: 0.55);
  // Opaque sibling of bgGlass used by GlassCard when BackdropFilter is
  // disabled. Picks the same hue but solid, so cards stay readable on top
  // of the AppBackground without the GPU cost of a per-card blur pass.
  static const Color bgCard = Color(0xFF111E30);

  static const Color accentPrimary = Color(0xFF4FC3FF);
  static const Color accentSecondary = Color(0xFF7AE3FF);
  static const Color accentDanger = Color(0xFFFF5577);
  static const Color accentWarn = Color(0xFFFFB347);
  static const Color accentSuccess = Color(0xFF5FE8A0);

  static const Color textPrimary = Color(0xFFE8F4FF);
  static const Color textSecondary = Color(0xFF8AA4C2);
  static const Color textDim = Color(0xFF4F6A87);

  static Color get borderSubtle => const Color(0xFF7AE3FF).withValues(alpha: 0.12);
  static Color get borderGlow => const Color(0xFF4FC3FF).withValues(alpha: 0.45);
}
