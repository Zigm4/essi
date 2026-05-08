import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../data/captures_repository.dart';
import '../domain/captures_models.dart';
import '../widgets/tag_input_field.dart';

class NoteEditorView extends ConsumerStatefulWidget {
  const NoteEditorView({super.key, this.note});

  final NoteModel? note;

  @override
  ConsumerState<NoteEditorView> createState() => _NoteEditorViewState();
}

class _NoteEditorViewState extends ConsumerState<NoteEditorView> {
  late final TextEditingController _title;
  late final TextEditingController _body;
  late List<String> _tags;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.note?.title ?? '');
    _body = TextEditingController(text: widget.note?.body ?? '');
    _tags = widget.note?.tags.map((t) => t.displayName).toList() ?? [];
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  bool get _canSave =>
      _title.text.trim().isNotEmpty || _body.text.trim().isNotEmpty;

  Future<void> _save() async {
    Haptics.of(ref).success();
    await ref.read(capturesRepositoryProvider).saveNote(
          id: widget.note?.id,
          title: _title.text,
          body: _body.text,
          tagDisplayNames: _tags,
        );
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final tagsAsync = ref.watch(tagsStreamProvider);
    final pool = (tagsAsync.valueOrNull ?? const <TagModel>[])
        .map((t) => t.displayName)
        .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.95,
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
                widget.note == null ? 'New note' : 'Edit note',
                style: AppTypography.headline,
              ),
              centerTitle: true,
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: TextButton(
                    onPressed: _canSave ? _save : null,
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
              child: ListView(
                controller: scroll,
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  MediaQuery.paddingOf(context).top +
                      kToolbarHeight +
                      AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.xxl + MediaQuery.viewInsetsOf(context).bottom,
                ),
                children: [
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _title,
                          decoration: InputDecoration(
                            hintText: 'Title',
                            hintStyle: AppTypography.title.copyWith(
                              color: AppColors.textDim,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          style: AppTypography.title,
                          textCapitalization: TextCapitalization.sentences,
                          onChanged: (_) => setState(() {}),
                        ),
                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(
                            vertical: AppSpacing.sm,
                          ),
                          color: AppColors.borderSubtle,
                        ),
                        TextField(
                          controller: _body,
                          decoration: InputDecoration(
                            hintText: 'Body',
                            hintStyle: AppTypography.body.copyWith(
                              color: AppColors.textDim,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          style: AppTypography.body,
                          textCapitalization: TextCapitalization.sentences,
                          minLines: 6,
                          maxLines: 30,
                          onChanged: (_) => setState(() {}),
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
              ),
            ),
          ),
        );
      },
    );
  }
}
