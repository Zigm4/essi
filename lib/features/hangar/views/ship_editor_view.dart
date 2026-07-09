import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error_text.dart';
import '../../../core/logging.dart';
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
import '../widgets/evil_ship_intro.dart';

class ShipEditorView extends ConsumerStatefulWidget {
  const ShipEditorView({super.key, this.ship});

  final ShipModel? ship;

  @override
  ConsumerState<ShipEditorView> createState() => _ShipEditorViewState();
}

class _ShipEditorViewState extends ConsumerState<ShipEditorView> {
  late final TextEditingController _name;
  late final TextEditingController _suffix; // number-only part for prefixed models
  late final TextEditingController _customModel;
  late final TextEditingController _hull;
  late final TextEditingController _sector;
  late final TextEditingController _sl;
  late final TextEditingController _zone;
  late final TextEditingController _customLocation;
  late final TextEditingController _note;
  late final Map<ShipRight, TextEditingController> _roleControllers;
  late List<String> _tags;
  final _tagController = TagInputController();
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  String? _modelKey;
  String? _locationKey;
  bool _registered = false;
  bool _evilIntroPlayed = false;

  // Snapshot of the initial field state, used for unsaved-changes detection
  // (F14). Re-baselined after programmatic normalization (suffix split, EVIL
  // defaults) so only genuine user edits count as dirty.
  late String _iName;
  late String _iSuffix;
  late String _iCustomModel;
  late String _iHull;
  late String _iSector;
  late String _iSl;
  late String _iZone;
  late String _iCustomLocation;
  late String _iNote;
  String? _iModelKey;
  String? _iLocationKey;
  bool _iRegistered = false;
  late Map<ShipRight, String> _iRoles;
  late List<String> _iTags;

  @override
  void initState() {
    super.initState();
    final s = widget.ship;
    _name = TextEditingController(text: s?.name ?? '');
    _suffix = TextEditingController();
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
    _captureInitial();
    // Keep PopScope.canPop fresh: rebuild whenever any free-text field changes
    // so the dirty flag is re-evaluated (F14).
    for (final c in [
      _name,
      _suffix,
      _customModel,
      _hull,
      _sector,
      _sl,
      _zone,
      _customLocation,
      _note,
      ..._roleControllers.values,
    ]) {
      c.addListener(_onFieldChanged);
    }
    // Editing an existing EVIL ship → replay the intro on open. Also split
    // the saved name into prefix + suffix so the editor surfaces just the
    // number when the model has a known prefix (e.g. `MMC-1234` → `1234`).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cat = ref.read(hangarCatalogsProvider).valueOrNull;
      if (cat == null) return;
      final entry = cat.shipForKey(_modelKey);
      if (entry != null && entry.hasPrefix) {
        final stripped = _extractSuffix(_name.text, entry.prefix);
        if (stripped != _suffix.text) {
          setState(() {
            _suffix.text = stripped;
            // The suffix was derived from the saved name, not typed by the
            // user — re-baseline so it doesn't read as an unsaved change.
            _captureInitial();
          });
        }
      }
      if (entry?.prefix == EvilShip.prefix && !_evilIntroPlayed) {
        _showEvilIntro();
      }
    });
  }

  /// Extracts the editable number suffix from a `PREFIX-NNNN` string.
  /// Falls back to the raw input if the prefix doesn't match.
  static String _extractSuffix(String name, String? prefix) {
    if (prefix == null || prefix.isEmpty) return '';
    final expected = '$prefix-';
    if (name.startsWith(expected)) {
      return name.substring(expected.length);
    }
    // Tolerate prefix without dash, just in case.
    if (name.startsWith(prefix)) {
      final rest = name.substring(prefix.length);
      return rest.startsWith('-') ? rest.substring(1) : rest;
    }
    return name;
  }

  bool _isEvilShip(HangarCatalogs cat) =>
      cat.shipForKey(_modelKey)?.prefix == EvilShip.prefix;

  bool get _evilLocked => _evilIntroPlayed;

  void _onFieldChanged() {
    if (mounted) setState(() {});
  }

  /// Snapshots the current field state as the baseline for dirty detection.
  void _captureInitial() {
    _iName = _name.text;
    _iSuffix = _suffix.text;
    _iCustomModel = _customModel.text;
    _iHull = _hull.text;
    _iSector = _sector.text;
    _iSl = _sl.text;
    _iZone = _zone.text;
    _iCustomLocation = _customLocation.text;
    _iNote = _note.text;
    _iModelKey = _modelKey;
    _iLocationKey = _locationKey;
    _iRegistered = _registered;
    _iRoles = {
      for (final e in _roleControllers.entries) e.key: e.value.text,
    };
    _iTags = List.of(_tags);
  }

  bool get _dirty {
    if (_name.text != _iName ||
        _suffix.text != _iSuffix ||
        _customModel.text != _iCustomModel ||
        _hull.text != _iHull ||
        _sector.text != _iSector ||
        _sl.text != _iSl ||
        _zone.text != _iZone ||
        _customLocation.text != _iCustomLocation ||
        _note.text != _iNote ||
        _modelKey != _iModelKey ||
        _locationKey != _iLocationKey ||
        _registered != _iRegistered ||
        !listEquals(_tags, _iTags)) {
      return true;
    }
    for (final e in _roleControllers.entries) {
      if (e.value.text != _iRoles[e.key]) return true;
    }
    return false;
  }

  /// Confirms discarding when the form is dirty. Returns true when the sheet
  /// may close (either not dirty, or the user chose to discard).
  Future<bool> _confirmDiscard() async {
    if (!_dirty) return true;
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Discard changes?', style: AppTypography.headline),
        content: Text(
          'You have unsaved changes.',
          style: AppTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Keep editing',
              style:
                  AppTypography.body.copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Discard',
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
        ],
      ),
    );
    return discard ?? false;
  }

  Future<void> _handleClose() async {
    if (await _confirmDiscard() && mounted) {
      Navigator.of(context).pop();
    }
  }

  void _applyEvilDefaults() {
    setState(() {
      _registered = true;
      _locationKey = EvilShip.defaultLocationKey;
      _customLocation.text = '';
      _zone.text = '';
      _sector.text = '';
      _sl.text = '';
      _name.text = EvilShip.fullIdentifier;
      _suffix.text = EvilShip.instanceNumber;
      for (final c in _roleControllers.values) {
        c.text = '';
      }
      // EVIL defaults are auto-applied and locked — re-baseline so they don't
      // trip the unsaved-changes guard on close.
      _captureInitial();
    });
  }

  Future<void> _showEvilIntro() async {
    Haptics.of(ref).warning();
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => EvilShipIntroView(
          onClose: () => Navigator.of(ctx).pop(),
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _evilIntroPlayed = true);
    _applyEvilDefaults();
    await EvilIntroState.markSeen(ref);
  }

  @override
  void dispose() {
    _name.dispose();
    _suffix.dispose();
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

  /// Composes the full display name. When the selected model has a known
  /// prefix, the user only types the suffix; otherwise [_name] is used as-is.
  String _composedName(HangarCatalogs cat) {
    final entry = cat.shipForKey(_modelKey);
    if (entry != null && entry.hasPrefix) {
      final suffix = _suffix.text.trim();
      return suffix.isEmpty ? '' : '${entry.prefix}-$suffix';
    }
    return _name.text.trim();
  }

  bool _canSaveFor(HangarCatalogs cat) =>
      _composedName(cat).trim().isNotEmpty;

  // Fallback when catalogs haven't loaded yet — let the user save based on
  // whatever is in the free-text name field.
  bool get _canSave => _name.text.trim().isNotEmpty ||
      _suffix.text.trim().isNotEmpty;

  Future<void> _save(HangarCatalogs cat) async {
    _tagController.commitPending();
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
      name: _composedName(cat),
      modelKey: _modelKey,
      // Persist the custom label exactly when its field is shown in the UI:
      // no model selected, or a catalog model without a known prefix. This
      // avoids saving stale hidden text and drops a prefix-less model's typed
      // label correctly.
      customModelLabel: _modelKey == null || entry?.hasPrefix == false
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
    try {
      await ref
          .read(hangarRepositoryProvider)
          .save(model, tagDisplayNames: _tags);
    } catch (e, st) {
      logError(e, st);
      _messengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(
              friendlyError(e, fallback: "Couldn't save — please try again.")),
        ),
      );
      return;
    }
    Haptics.of(ref).success();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final catAsync = ref.watch(hangarCatalogsProvider);
    final tagsAsync = ref.watch(tagsStreamProvider);
    final pool = (tagsAsync.valueOrNull ?? const <TagModel>[])
        .map((t) => t.displayName)
        .toList();

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleClose();
      },
      child: ScaffoldMessenger(
        key: _messengerKey,
        child: DraggableScrollableSheet(
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
                onPressed: _handleClose,
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
                  child: Builder(builder: (context) {
                    final canSave = catAsync.hasValue
                        ? _canSaveFor(catAsync.requireValue)
                        : _canSave;
                    return TextButton(
                      onPressed: catAsync.hasValue && canSave
                          ? () => _save(catAsync.requireValue)
                          : null,
                      child: Text(
                        'Save',
                        style: AppTypography.body.copyWith(
                          color: canSave
                              ? AppColors.accentPrimary
                              : AppColors.textDim,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  }),
                ),
              ],
            ),
            body: AppBackground(
              showsScanlines: false,
              child: catAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    friendlyError(e, fallback: "Couldn't load the ship catalog."),
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
                            if (entry != null && entry.hasPrefix)
                              _LabeledField(
                                label: 'Call sign',
                                child: _PrefixNumberField(
                                  prefix: entry.prefix!,
                                  controller: _suffix,
                                  enabled: !_evilLocked,
                                  onChanged: (_) => setState(() {}),
                                ),
                              )
                            else
                              _LabeledField(
                                label: 'Name',
                                child: TextField(
                                  controller: _name,
                                  decoration:
                                      _decoration(hint: "Ship's call sign"),
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
                                disabled: _evilLocked,
                                onChange: (k) {
                                  final next = cat.shipForKey(k);
                                  // Switching models: split or join the
                                  // identifier so the right input is shown
                                  // pre-filled with whatever the user had.
                                  setState(() {
                                    _modelKey = k;
                                    if (next != null && next.hasPrefix) {
                                      final existing = _name.text.trim();
                                      _suffix.text = _extractSuffix(
                                          existing, next.prefix);
                                    } else {
                                      // Falling back to free-text — if we
                                      // were on a prefixed model, promote
                                      // the suffix back into the name.
                                      if (_suffix.text.isNotEmpty &&
                                          _name.text.trim().isEmpty) {
                                        _name.text = _suffix.text.trim();
                                      }
                                      _suffix.clear();
                                    }
                                  });
                                  if (next?.prefix == EvilShip.prefix) {
                                    final seen = EvilIntroState.isSeen(ref);
                                    if (seen) {
                                      setState(() => _evilIntroPlayed = true);
                                      _applyEvilDefaults();
                                    } else {
                                      _showEvilIntro();
                                    }
                                  }
                                },
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
                      if (_isEvilShip(cat))
                        GlassCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SectionHeader(
                                title: 'Owner',
                                icon: Icons.shield_moon,
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.directions_boat_filled,
                                    color: AppColors.accentSecondary,
                                    size: 18,
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Text(
                                    EvilShip.ownerLabel,
                                    style: AppTypography.body,
                                  ),
                                  const Spacer(),
                                  Text(
                                    EvilShip.fullIdentifier,
                                    style: AppTypography.mono.copyWith(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.accentSecondary,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                'Roles do not apply to the void ship. She answers no captain.',
                                style: AppTypography.caption,
                              ),
                            ],
                          ),
                        )
                      else if (availableRoles.isNotEmpty)
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
                        controller: _tagController,
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
        ),
      ),
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
