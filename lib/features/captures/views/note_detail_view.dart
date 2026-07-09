import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/relative_date.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../data/captures_repository.dart';
import '../domain/captures_models.dart';
import '../widgets/markdown_view.dart';
import '../widgets/tag_chip.dart';
import 'note_editor_view.dart';

class NoteDetailView extends ConsumerWidget {
  const NoteDetailView({super.key, required this.noteId});

  final String noteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesAsync = ref.watch(notesStreamProvider);
    final note = notesAsync.valueOrNull
        ?.firstWhere((n) => n.id == noteId, orElse: () => _placeholderNote);
    if (note == null || note.id.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bgDeepest,
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Note', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
        actions: [
          TextButton(
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                // F14: disable swipe-to-dismiss so the editor's unsaved-changes
                // PopScope guard isn't bypassed.
                enableDrag: false,
                backgroundColor: Colors.transparent,
                builder: (_) => NoteEditorView(note: note),
              );
            },
            child: Text(
              'Edit',
              style: AppTypography.body.copyWith(
                color: AppColors.accentPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      body: AppBackground(
        child: PageScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (note.title.isNotEmpty)
                      Text(note.title, style: AppTypography.title),
                    if (note.body.isNotEmpty) ...[
                      if (note.title.isNotEmpty)
                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(
                            vertical: AppSpacing.md,
                          ),
                          color: AppColors.borderSubtle,
                        ),
                      UnderdeckMarkdownView(markdown: note.body),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Text(
                    formatRelativeDate(note.updatedAt),
                    style: AppTypography.caption,
                  ),
                  const Spacer(),
                  if (note.tags.isNotEmpty)
                    Flexible(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        reverse: true,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            for (final t in note.tags) ...[
                              TagChip(label: t.displayName),
                              const SizedBox(width: 4),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final _placeholderNote = NoteModel(
  id: '',
  title: '',
  body: '',
  createdAt: DateTime.fromMillisecondsSinceEpoch(0),
  updatedAt: DateTime.fromMillisecondsSinceEpoch(0),
  tags: const [],
);
