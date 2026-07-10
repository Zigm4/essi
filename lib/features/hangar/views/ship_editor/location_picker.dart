part of '../ship_editor_view.dart';

class _LocationPicker extends StatelessWidget {
  const _LocationPicker({
    required this.catalogs,
    required this.locationKey,
    required this.onChange,
  });
  final HangarCatalogs catalogs;
  final String? locationKey;
  final ValueChanged<String?> onChange;

  @override
  Widget build(BuildContext context) {
    final selected = catalogs.locationForKey(locationKey);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(context),
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
                selected?.displayName ?? 'Pick a location',
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
      builder: (ctx) => _LocationPickerSheet(
        catalogs: catalogs,
        current: locationKey,
      ),
    );
    // Null = dismissed without choosing → leave the selection unchanged.
    if (result != null) onChange(result.key);
  }
}

class _LocationPickerSheet extends StatelessWidget {
  const _LocationPickerSheet({required this.catalogs, required this.current});
  final HangarCatalogs catalogs;
  final String? current;

  @override
  Widget build(BuildContext context) {
    final groups = catalogs.grouped;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pick a location', style: AppTypography.headline),
            const SizedBox(height: AppSpacing.md),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  ListTile(
                    leading: const Icon(Icons.cancel,
                        color: AppColors.textSecondary),
                    title: Text('No location', style: AppTypography.body),
                    onTap: () =>
                        Navigator.of(context).pop(const _PickResult(null)),
                    selected: current == null,
                  ),
                  for (final g in groups.entries) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                      child: Text(
                        g.key.toUpperCase(),
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                          color: AppColors.accentPrimary,
                        ),
                      ),
                    ),
                    for (final l in g.value)
                      ListTile(
                        title: Text(l.displayName, style: AppTypography.body),
                        subtitle: l.subtitle == null
                            ? null
                            : Text(l.subtitle!, style: AppTypography.caption),
                        selected: current == l.key,
                        onTap: () =>
                            Navigator.of(context).pop(_PickResult(l.key)),
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
