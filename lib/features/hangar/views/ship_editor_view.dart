import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../../captures/data/captures_repository.dart';
import '../../captures/domain/captures_models.dart';
import '../../captures/widgets/tag_input_field.dart';
import '../data/hangar_repository.dart';
import '../domain/hangar_models.dart';

class ShipEditorView extends ConsumerStatefulWidget {
  const ShipEditorView({super.key, this.ship});

  final ShipModel? ship;

  @override
  ConsumerState<ShipEditorView> createState() => _ShipEditorViewState();
}

class _ShipEditorViewState extends ConsumerState<ShipEditorView> {
  late final TextEditingController _name;
  late final TextEditingController _customModel;
  late final TextEditingController _hull;
  late final TextEditingController _sector;
  late final TextEditingController _sl;
  late final TextEditingController _zone;
  late final TextEditingController _customLocation;
  late final TextEditingController _note;
  late final Map<ShipRight, TextEditingController> _roleControllers;
  late List<String> _tags;

  String? _modelKey;
  String? _locationKey;
  bool _registered = false;

  @override
  void initState() {
    super.initState();
    final s = widget.ship;
    _name = TextEditingController(text: s?.name ?? '');
    _customModel = TextEditingController(text: s?.customModelLabel ?? '');
    _hull = TextEditingController(text: s?.hull?.toString() ?? '');
    _sector = TextEditingController(text: s?.locationSector ?? '');
    _sl = TextEditingController(text: s?.locationSL?.toString() ?? '');
    _zone = TextEditingController(text: s?.locationZone?.toString() ?? '');
    _customLocation = TextEditingController(text: s?.customLocation ?? '');
    _note = TextEditingController(text: s?.note ?? '');
    _modelKey = s?.modelKey;
    _locationKey = s?.locationKey;
    _registered = s?.registered ?? false;
    _tags = s?.tags.map((t) => t.displayName).toList() ?? [];
    _roleControllers = {
      for (final r in shipSeatOrder)
        r: TextEditingController(text: s?.roleName(r) ?? ''),
    };
  }

  @override
  void dispose() {
    _name.dispose();
    _customModel.dispose();
    _hull.dispose();
    _sector.dispose();
    _sl.dispose();
    _zone.dispose();
    _customLocation.dispose();
    _note.dispose();
    for (final c in _roleControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _canSave => _name.text.trim().isNotEmpty;

  Future<void> _save(HangarCatalogs cat) async {
    final entry = cat.shipForKey(_modelKey);
    final loc = cat.locationForKey(_locationKey);
    final hull = int.tryParse(_hull.text.trim());
    final zone = int.tryParse(_zone.text.trim());
    final sl = int.tryParse(_sl.text.trim());
    final roles = <ShipRight, String?>{
      for (final e in _roleControllers.entries)
        e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim(),
    };
    final model = ShipModel(
      id: widget.ship?.id ?? '',
      name: _name.text.trim(),
      modelKey: _modelKey,
      customModelLabel: entry?.hasPrefix == true || _modelKey == null
          ? (_customModel.text.trim().isEmpty
              ? null
              : _customModel.text.trim())
          : null,
      registered: _registered,
      locationKey: _locationKey,
      customLocation: _locationKey == HangarCatalogs.customLocationKey
          ? (_customLocation.text.trim().isEmpty
              ? null
              : _customLocation.text.trim())
          : null,
      locationZone: loc?.supportsZone == true ? zone : null,
      locationSector: loc?.supportsSpaceCoordinate == true
          ? (_sector.text.trim().isEmpty ? null : _sector.text.trim())
          : null,
      locationSL: loc?.supportsSpaceCoordinate == true ? sl : null,
      hull: hull,
      roles: roles,
      note: _note.text,
      createdAt: widget.ship?.createdAt ?? DateTime.now(),
      updatedAt: DateTime.now(),
    );
    Haptics.of(ref).success();
    await ref
        .read(hangarRepositoryProvider)
        .save(model, tagDisplayNames: _tags);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final catAsync = ref.watch(hangarCatalogsProvider);
    final tagsAsync = ref.watch(tagsStreamProvider);
    final pool = (tagsAsync.valueOrNull ?? const <TagModel>[])
        .map((t) => t.displayName)
        .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.95,
      minChildSize: 0.5,
      maxChildSize: 0.97,
      expand: false,
      builder: (context, scroll) {
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
                  'Cancel',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              leadingWidth: 80,
              title: Text(
                widget.ship == null ? 'New ship' : 'Edit ship',
                style: AppTypography.headline,
              ),
              centerTitle: true,
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: TextButton(
                    onPressed: catAsync.hasValue && _canSave
                        ? () => _save(catAsync.requireValue)
                        : null,
                    child: Text(
                      'Save',
                      style: AppTypography.body.copyWith(
                        color: _canSave
                            ? AppColors.accentPrimary
                            : AppColors.textDim,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: catAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    'Error: $e',
                    style: AppTypography.body
                        .copyWith(color: AppColors.accentDanger),
                  ),
                ),
                data: (cat) {
                  final entry = cat.shipForKey(_modelKey);
                  final availableRoles =
                      entry?.availableRoles ?? shipSeatOrder;
                  final loc = cat.locationForKey(_locationKey);
                  return ListView(
                    controller: scroll,
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      MediaQuery.paddingOf(context).top +
                          kToolbarHeight +
                          AppSpacing.sm,
                      AppSpacing.md,
                      AppSpacing.xxl +
                          MediaQuery.viewInsetsOf(context).bottom,
                    ),
                    children: [
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SectionHeader(title: 'Identity'),
                            const SizedBox(height: AppSpacing.sm),
                            _LabeledField(
                              label: 'Name',
                              child: TextField(
                                controller: _name,
                                decoration: _decoration(hint: "Ship's call sign"),
                                style: AppTypography.body,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            _LabeledField(
                              label: 'Model',
                              child: _ModelPicker(
                                catalogs: cat,
                                modelKey: _modelKey,
                                onChange: (k) =>
                                    setState(() => _modelKey = k),
                              ),
                            ),
                            if (_modelKey == null ||
                                entry?.hasPrefix == false) ...[
                              const SizedBox(height: AppSpacing.md),
                              _LabeledField(
                                label: 'Custom model label',
                                child: TextField(
                                  controller: _customModel,
                                  decoration: _decoration(
                                      hint: 'e.g. MMC-1234 (optional)'),
                                  style: AppTypography.mono,
                                ),
                              ),
                            ],
                            const SizedBox(height: AppSpacing.md),
                            Row(
                              children: [
                                Switch(
                                  value: _registered,
                                  onChanged: (v) =>
                                      setState(() => _registered = v),
                                  activeThumbColor: AppColors.accentSuccess,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Text('Registered',
                                    style: AppTypography.body),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SectionHeader(
                              title: 'Location',
                              icon: Icons.place,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            _LocationPicker(
                              catalogs: cat,
                              locationKey: _locationKey,
                              onChange: (k) =>
                                  setState(() => _locationKey = k),
                            ),
                            if (loc?.supportsZone == true) ...[
                              const SizedBox(height: AppSpacing.md),
                              _LabeledField(
                                label: 'Zone',
                                child: TextField(
                                  controller: _zone,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                  ],
                                  decoration: _decoration(
                                    hint: '${loc?.defaultZone ?? 55}',
                                  ),
                                  style: AppTypography.mono,
                                ),
                              ),
                            ],
                            if (loc?.supportsSpaceCoordinate == true) ...[
                              const SizedBox(height: AppSpacing.md),
                              Row(
                                children: [
                                  Expanded(
                                    child: _LabeledField(
                                      label: 'Sector',
                                      child: TextField(
                                        controller: _sector,
                                        decoration:
                                            _decoration(hint: 'A-1'),
                                        style: AppTypography.mono,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.md),
                                  Expanded(
                                    child: _LabeledField(
                                      label: 'SL',
                                      child: TextField(
                                        controller: _sl,
                                        keyboardType: TextInputType.number,
                                        inputFormatters: [
                                          FilteringTextInputFormatter.digitsOnly,
                                        ],
                                        decoration: _decoration(hint: '0'),
                                        style: AppTypography.mono,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (_locationKey ==
                                HangarCatalogs.customLocationKey) ...[
                              const SizedBox(height: AppSpacing.md),
                              _LabeledField(
                                label: 'Custom location',
                                child: TextField(
                                  controller: _customLocation,
                                  decoration: _decoration(hint: 'Free text'),
                                  style: AppTypography.body,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SectionHeader(title: 'Hull', icon: Icons.shield),
                            const SizedBox(height: AppSpacing.sm),
                            _LabeledField(
                              label: entry?.hullMax != null
                                  ? 'Hull (max ${entry!.hullMax})'
                                  : 'Hull',
                              child: TextField(
                                controller: _hull,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: _decoration(hint: '0'),
                                style: AppTypography.mono,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (availableRoles.isNotEmpty)
                        GlassCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SectionHeader(
                                title: 'Crew roles',
                                icon: Icons.groups,
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              for (final r in availableRoles)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 4,
                                  ),
                                  child: TextField(
                                    controller: _roleControllers[r],
                                    decoration: _decoration(
                                      hint: r.placeholder,
                                      label: r.displayName,
                                    ),
                                    style: AppTypography.body,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      const SizedBox(height: AppSpacing.lg),
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SectionHeader(
                              title: 'Note',
                              icon: Icons.notes,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            TextField(
                              controller: _note,
                              decoration: _decoration(
                                  hint: 'Anything else worth knowing about this ship'),
                              style: AppTypography.body,
                              minLines: 3,
                              maxLines: 10,
                              textCapitalization:
                                  TextCapitalization.sentences,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      const SectionHeader(title: 'Tags', icon: Icons.tag),
                      const SizedBox(height: AppSpacing.sm),
                      TagInputField(
                        selectedTags: _tags,
                        onChanged: (tags) => setState(() => _tags = tags),
                        suggestionPool: pool,
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  InputDecoration _decoration({String? hint, String? label}) {
    return InputDecoration(
      hintText: hint,
      labelText: label,
      labelStyle: AppTypography.caption,
      hintStyle: AppTypography.body.copyWith(color: AppColors.textDim),
      filled: true,
      fillColor: AppColors.bgGlass,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        borderSide: BorderSide(color: AppColors.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        borderSide: BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        borderSide: BorderSide(color: AppColors.borderGlow),
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.caption.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}

class _ModelPicker extends StatelessWidget {
  const _ModelPicker({
    required this.catalogs,
    required this.modelKey,
    required this.onChange,
  });
  final HangarCatalogs catalogs;
  final String? modelKey;
  final ValueChanged<String?> onChange;

  @override
  Widget build(BuildContext context) {
    final selected = catalogs.shipForKey(modelKey);
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
    );
  }

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _ModelPickerSheet(catalogs: catalogs, current: modelKey),
    );
    onChange(picked);
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
                    onTap: () => Navigator.of(context).pop(null),
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
                        onTap: () => Navigator.of(context).pop(s.key),
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
    final picked = await showModalBottomSheet<String?>(
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
    onChange(picked);
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
                    onTap: () => Navigator.of(context).pop(null),
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
                        onTap: () => Navigator.of(context).pop(l.key),
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
