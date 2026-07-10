part of '../ship_editor_view.dart';

/// Two-part call-sign input: a static `PREFIX-` chip on the left and a
/// number-only TextField on the right. Used in the Hangar identity card
/// when the picked ship model has a known prefix — the user just types the
/// instance number, matching the iOS Swift reference.
class _PrefixNumberField extends StatelessWidget {
  const _PrefixNumberField({
    required this.prefix,
    required this.controller,
    required this.enabled,
    required this.onChanged,
  });

  final String prefix;
  final TextEditingController controller;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Text(
            '$prefix-',
            style: AppTypography.mono.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.accentSecondary,
            ),
          ),
          const SizedBox(width: 2),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              onChanged: onChanged,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              style: AppTypography.mono.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
              decoration: const InputDecoration(
                isCollapsed: true,
                hintText: 'number',
                contentPadding: EdgeInsets.symmetric(vertical: 14),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
