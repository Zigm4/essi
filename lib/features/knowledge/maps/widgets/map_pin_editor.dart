import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error_text.dart';
import '../../../../core/logging.dart';
import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../data/map_pins_repository.dart';
import '../domain/map_theme.dart';

/// Small editor for a personal note pinned to one map zone (Phase E §6.1).
/// Mirrors the note-editor pattern: a single [TextField], an explicit Save, and
/// a [PopScope] unsaved-changes guard. Tinted by the zone's resolved [MapTheme]
/// so it feels part of the [ZoneSheet] it opens from.
///
/// Opens create-or-edit: if a pin already exists for (mapId, zoneId) its note is
/// preloaded. Saving an empty note deletes the pin (handled by the repository).
class MapPinEditor extends ConsumerStatefulWidget {
  const MapPinEditor({
    super.key,
    required this.mapId,
    required this.zoneId,
    required this.zoneName,
    required this.theme,
    this.initialNote = '',
  });

  final String mapId;
  final String zoneId;
  final String zoneName;
  final MapTheme theme;
  final String initialNote;

  /// Shows the editor as a modal bottom sheet on top of the zone sheet.
  static Future<void> show(
    BuildContext context, {
    required String mapId,
    required String zoneId,
    required String zoneName,
    required MapTheme theme,
    String initialNote = '',
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MapPinEditor(
        mapId: mapId,
        zoneId: zoneId,
        zoneName: zoneName,
        theme: theme,
        initialNote: initialNote,
      ),
    );
  }

  @override
  ConsumerState<MapPinEditor> createState() => _MapPinEditorState();
}

class _MapPinEditorState extends ConsumerState<MapPinEditor> {
  late final TextEditingController _note;
  late final String _initialNote;
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    _note = TextEditingController(text: widget.initialNote);
    _initialNote = widget.initialNote;
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  bool get _dirty => _note.text != _initialNote;

  Future<bool> _confirmDiscard() async {
    if (!_dirty) return true;
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Discard changes?', style: AppTypography.headline),
        content: Text('You have unsaved changes.', style: AppTypography.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Keep editing',
                style: AppTypography.body
                    .copyWith(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Discard',
                style:
                    AppTypography.body.copyWith(color: AppColors.accentDanger)),
          ),
        ],
      ),
    );
    return discard ?? false;
  }

  Future<void> _handleClose() async {
    if (await _confirmDiscard() && mounted) Navigator.of(context).pop();
  }

  Future<void> _save() async {
    try {
      await ref.read(mapPinsRepositoryProvider).savePin(
            mapId: widget.mapId,
            zoneId: widget.zoneId,
            note: _note.text,
          );
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
    final theme = widget.theme;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleClose();
      },
      child: ScaffoldMessenger(
        key: _messengerKey,
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: theme.surface,
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.lg)),
              border: Border(
                top: BorderSide(
                    color: theme.zoneStroke.withValues(alpha: 0.35)),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md,
                    AppSpacing.lg, AppSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.push_pin_outlined,
                            size: 18, color: theme.accent),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            'Note · ${widget.zoneName}',
                            style: AppTypography.headline.copyWith(
                              fontFamily: theme.fontFamily,
                              color: theme.label,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        TextButton(
                          onPressed: _handleClose,
                          child: Text('Cancel',
                              style: AppTypography.body.copyWith(
                                  color: AppColors.textSecondary)),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _note,
                      autofocus: true,
                      minLines: 3,
                      maxLines: 8,
                      // Match the import cap (maxMapPinNoteLength) so a locally
                      // authored note can't be silently truncated on round-trip.
                      maxLength: 20000,
                      textCapitalization: TextCapitalization.sentences,
                      style: AppTypography.body.copyWith(color: theme.label),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: 'Your note for this zone…',
                        hintStyle: AppTypography.body
                            .copyWith(color: theme.label.withValues(alpha: 0.4)),
                        filled: true,
                        fillColor: AppColors.bgGlass,
                        contentPadding: const EdgeInsets.all(AppSpacing.md),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide:
                              BorderSide(color: AppColors.borderSubtle),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide:
                              BorderSide(color: AppColors.borderSubtle),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide: BorderSide(color: theme.accent),
                        ),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton(
                        onPressed: _dirty ? _save : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: theme.accent,
                          foregroundColor: AppColors.bgDeepest,
                          disabledBackgroundColor:
                              theme.accent.withValues(alpha: 0.25),
                        ),
                        child: const Text('Save'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
