import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../data/captures_repository.dart';
import '../domain/captures_models.dart';
import '../widgets/note_card.dart';
import '../widgets/tag_chip.dart';

final notesSearchProvider = StateProvider<String>((ref) => '');
final notesSelectedTagsProvider =
    StateProvider<Set<String>>((ref) => <String>{});

class NotesListView extends ConsumerWidget {
  const NotesListView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesAsync = ref.watch(notesStreamProvider);
    final tagsAsync = ref.watch(tagsStreamProvider);
    final search = ref.watch(notesSearchProvider).toLowerCase();
    final selected = ref.watch(notesSelectedTagsProvider);

    return notesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text(
          'Error: $e',
          style: AppTypography.body.copyWith(color: AppColors.accentDanger),
        ),
      ),
      data: (notes) {
        final tags = tagsAsync.valueOrNull ?? const <TagModel>[];
        final filtered = notes.where((n) {
          final textOk = search.isEmpty ||
              n.title.toLowerCase().contains(search) ||
              n.body.toLowerCase().contains(search);
          final tagsOk = selected.isEmpty ||
              n.tags.any((t) => selected.contains(t.id));
          return textOk && tagsOk;
        }).toList();

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.sm,
                ),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search notes',
                    hintStyle: AppTypography.body.copyWith(
                      color: AppColors.textDim,
                    ),
                    prefixIcon: const Icon(Icons.search,
                        color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.bgGlass,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
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
                  ),
                  style: AppTypography.body,
                  onChanged: (v) =>
                      ref.read(notesSearchProvider.notifier).state = v,
                ),
              ),
            ),
            if (tags.isNotEmpty)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                    ),
                    itemCount: tags.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(width: AppSpacing.sm),
                    itemBuilder: (_, i) {
                      final tag = tags[i];
                      final isSel = selected.contains(tag.id);
                      return Center(
                        child: TagChip(
                          label: tag.displayName,
                          selected: isSel,
                          onTap: () {
                            final next = {...selected};
                            if (isSel) {
                              next.remove(tag.id);
                            } else {
                              next.add(tag.id);
                            }
                            ref.read(notesSelectedTagsProvider.notifier).state =
                                next;
                          },
                        ),
                      );
                    },
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.sm)),
            if (filtered.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _EmptyState(query: search.isNotEmpty),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                ),
                sliver: SliverList.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, i) {
                    final note = filtered[i];
                    return _NoteRow(note: note);
                  },
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
          ],
        );
      },
    );
  }
}

class _NoteRow extends ConsumerWidget {
  const _NoteRow({required this.note});
  final NoteModel note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.push('/captures/note/${note.id}'),
      onLongPress: () => _confirmDelete(context, ref),
      child: NoteCard(note: note),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete note?', style: AppTypography.headline),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete',
              style: AppTypography.body.copyWith(
                color: AppColors.accentDanger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await ref.read(capturesRepositoryProvider).deleteNote(note.id);
    }
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.query});
  final bool query;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.note_outlined,
              size: 48,
              color: AppColors.accentPrimary.withValues(alpha: 0.4),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              query ? 'No matches' : 'No notes yet',
              style: AppTypography.headline,
            ),
            const SizedBox(height: 4),
            Text(
              query ? 'Try a different search.' : 'Tap + to capture your first note.',
              style: AppTypography.caption,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
