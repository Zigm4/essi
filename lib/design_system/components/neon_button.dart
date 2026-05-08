import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/haptics.dart';
import '../colors.dart';
import '../spacing.dart';

class NeonButton extends ConsumerStatefulWidget {
  const NeonButton({
    super.key,
    required this.title,
    required this.onPressed,
    this.icon,
    this.enabled = true,
    this.danger = false,
  });

  final String title;
  final IconData? icon;
  final VoidCallback onPressed;
  final bool enabled;
  final bool danger;

  @override
  ConsumerState<NeonButton> createState() => _NeonButtonState();
}

class _NeonButtonState extends ConsumerState<NeonButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tint = widget.danger ? AppColors.accentDanger : AppColors.accentPrimary;
    final tint2 = widget.danger ? AppColors.accentWarn : AppColors.accentSecondary;
    return Opacity(
      opacity: widget.enabled ? 1 : 0.4,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: widget.enabled ? (_) => setState(() => _pressed = true) : null,
        onTapCancel: () => setState(() => _pressed = false),
        onTapUp: (_) {
          setState(() => _pressed = false);
          if (!widget.enabled) return;
          Haptics.of(ref).tap();
          widget.onPressed();
        },
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1.0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          child: Container(
            constraints: const BoxConstraints(minHeight: 50),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.md),
              gradient: LinearGradient(
                colors: [tint, tint2],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              border: Border.all(color: AppColors.borderGlow, width: 1),
              boxShadow: [
                BoxShadow(color: tint.withValues(alpha: 0.45), blurRadius: 14),
              ],
            ),
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.icon != null) ...[
                    Icon(widget.icon, color: AppColors.bgDeepest, size: 18),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.bgDeepest,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
