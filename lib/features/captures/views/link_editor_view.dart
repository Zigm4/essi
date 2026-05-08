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

class LinkEditorView extends ConsumerStatefulWidget {
  const LinkEditorView({super.key, this.link});

  final LinkModel? link;

  @override
  ConsumerState<LinkEditorView> createState() => _LinkEditorViewState();
}

class _LinkEditorViewState extends ConsumerState<LinkEditorView> {
  late final TextEditingController _title;
  late final TextEditingController _url;
  late final TextEditingController _note;
  late List<String> _tags;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.link?.title ?? '');
    _url = TextEditingController(text: widget.link?.url ?? '');
    _note = TextEditingController(text: widget.link?.note ?? '');
    _tags = widget.link?.tags.map((t) => t.displayName).toList() ?? [];
  }

  @override
  void dispose() {
    _title.dispose();
    _url.dispose();
    _note.dispose();
    super.dispose();
  }

  bool get _canSave => _url.text.trim().isNotEmpty;

  Future<void> _save() async {
    Haptics.of(ref).success();
    await ref.read(capturesRepositoryProvider).saveLink(
          id: widget.link?.id,
          title: _title.text,
          url: _url.text,
          note: _note.text,
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
                widget.link == null ? 'New link' : 'Edit link',
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
                            hintText: 'Title (optional)',
                            hintStyle: AppTypography.headline.copyWith(
                              color: AppColors.textDim,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          style: AppTypography.headline,
                          textCapitalization: TextCapitalization.sentences,
                        ),
                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(
                            vertical: AppSpacing.sm,
                          ),
                          color: AppColors.borderSubtle,
                        ),
                        TextField(
                          controller: _url,
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          enableSuggestions: false,
                          decoration: InputDecoration(
                            hintText: 'https://...',
                            hintStyle: AppTypography.mono.copyWith(
                              fontSize: 13,
                              color: AppColors.textDim,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          style: AppTypography.mono.copyWith(fontSize: 13),
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
                          controller: _note,
                          decoration: InputDecoration(
                            hintText: 'Note (optional)',
                            hintStyle: AppTypography.body.copyWith(
                              color: AppColors.textDim,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          style: AppTypography.body,
                          textCapitalization: TextCapitalization.sentences,
                          minLines: 3,
                          maxLines: 10,
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
