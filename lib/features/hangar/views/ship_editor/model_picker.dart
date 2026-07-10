part of '../ship_editor_view.dart';

/// Distinguishes an explicit picker choice (including "None", a [_PickResult]
/// with a null [key]) from a barrier/swipe dismissal, which yields a null
/// future. Without this, both dismissal and "No model/location" look identical
/// and dismissing would wrongly clear the current selection.
class _PickResult {
  const _PickResult(this.key);
  final String? key;
}

class _ModelPicker extends StatelessWidget {
  const _ModelPicker({
    required this.catalogs,
    required this.modelKey,
    required this.onChange,
    this.disabled = false,
  });
  final HangarCatalogs catalogs;
  final String? modelKey;
  final ValueChanged<String?> onChange;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final selected = catalogs.shipForKey(modelKey);
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: disabled ? null : () => _open(context),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 12,
        ),
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                selected?.displayName ?? 'Pick a model',
                style: AppTypography.body.copyWith(
                  color: selected == null
                      ? AppColors.textDim
                      : AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(Icons.expand_more, color: AppColors.textSecondary),
          ],
        ),
      ),
    ),
    );
  }

  Future<void> _open(BuildContext context) async {
    final result = await showModalBottomSheet<_PickResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _ModelPickerSheet(catalogs: catalogs, current: modelKey),
    );
    // Null = dismissed without choosing → leave the selection unchanged.
    if (result != null) onChange(result.key);
  }
}

class _ModelPickerSheet extends StatelessWidget {
  const _ModelPickerSheet({required this.catalogs, required this.current});
  final HangarCatalogs catalogs;
  final String? current;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pick a model', style: AppTypography.headline),
            const SizedBox(height: AppSpacing.md),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  ListTile(
                    leading: const Icon(Icons.cancel,
                        color: AppColors.textSecondary),
                    title: Text('No model', style: AppTypography.body),
                    onTap: () =>
                        Navigator.of(context).pop(const _PickResult(null)),
                    selected: current == null,
                  ),
                  for (final cat in HangarCatalogs.craftCategoriesInOrder) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        12,
                        12,
                        12,
                        4,
                      ),
                      child: Text(
                        cat.toUpperCase(),
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                          color: AppColors.accentPrimary,
                        ),
                      ),
                    ),
                    for (final s in catalogs.shipsIn(cat))
                      ListTile(
                        title: Text(s.displayName, style: AppTypography.body),
                        subtitle: s.crewSize != null
                            ? Text('Crew ${s.crewSize}',
                                style: AppTypography.caption)
                            : null,
                        selected: current == s.key,
                        onTap: () =>
                            Navigator.of(context).pop(_PickResult(s.key)),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
