import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../data/captures_repository.dart';
import '../domain/captures_models.dart';
import '../widgets/link_card.dart';
import '../widgets/tag_chip.dart';

// autoDispose so re-entering the screen starts from an empty query, matching
// the freshly-built (controller-less) search field instead of showing stale
// results under a blank box.
final linksSearchProvider = StateProvider.autoDispose<String>((ref) => '');
final linksSelectedTagsProvider =
    StateProvider<Set<String>>((ref) => <String>{});

class LinksListView extends ConsumerWidget {
  const LinksListView({super.key, this.scrollController});

  /// Optional external controller so the surrounding banner can react to
  /// the list's scroll offset.
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linksAsync = ref.watch(linksStreamProvider);
    final tagsAsync = ref.watch(tagsStreamProvider);
    final search = ref.watch(linksSearchProvider).toLowerCase();
    final selected = ref.watch(linksSelectedTagsProvider);

    return linksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text(
          friendlyError(e, fallback: "Couldn't load your links."),
          style: AppTypography.body.copyWith(color: AppColors.accentDanger),
        ),
      ),
      data: (links) {
        final tags = tagsAsync.valueOrNull ?? const <TagModel>[];
        final filtered = links.where((l) {
          final textOk = search.isEmpty ||
              l.title.toLowerCase().contains(search) ||
              l.url.toLowerCase().contains(search) ||
              l.note.toLowerCase().contains(search);
          final tagsOk = selected.isEmpty ||
              l.tags.any((t) => selected.contains(t.id));
          return textOk && tagsOk;
        }).toList();

        return CustomScrollView(
          controller: scrollController,
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
                    hintText: 'Search links',
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
                      ref.read(linksSearchProvider.notifier).state = v,
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
                            ref.read(linksSelectedTagsProvider.notifier).state =
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
                child: _EmptyLinks(query: search.isNotEmpty),
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
                    final link = filtered[i];
                    return _LinkRow(link: link);
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

class _LinkRow extends ConsumerWidget {
  const _LinkRow({required this.link});
  final LinkModel link;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.push('/captures/link/${link.id}'),
      onLongPress: () => _confirmDelete(context, ref),
      child: LinkCard(link: link),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete link?', style: AppTypography.headline),
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
      await ref.read(capturesRepositoryProvider).deleteLink(link.id);
    }
  }
}

class _EmptyLinks extends StatelessWidget {
  const _EmptyLinks({required this.query});
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
              Icons.link,
              size: 48,
              color: AppColors.accentPrimary.withValues(alpha: 0.4),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              query ? 'No matches' : 'No links yet',
              style: AppTypography.headline,
            ),
            const SizedBox(height: 4),
            Text(
              query
                  ? 'Try a different search.'
                  : 'Save Discord messages and other URLs here.',
              style: AppTypography.caption,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
