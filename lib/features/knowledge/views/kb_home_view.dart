import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/banner_page.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../captures/widgets/tag_chip.dart';
import '../data/kb_loader.dart';
import '../domain/kb_models.dart';

// autoDispose so re-entering the screen starts from an empty query, matching
// the freshly-built (controller-less) search field instead of showing stale
// results under a blank box.
final kbSearchProvider = StateProvider.autoDispose<String>((ref) => '');

class KBHomeView extends ConsumerWidget {
  const KBHomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(kbDataProvider);
    final search = ref.watch(kbSearchProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: AppBackground(
        child: BannerPage(
          bannerLabel: 'ESSI · Archive & Doctrine',
          builder: (context, ctrl) => dataAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Text(
                friendlyError(e, fallback: "Couldn't load the knowledge base."),
                style: AppTypography.body.copyWith(color: AppColors.accentDanger),
              ),
            ),
            data: (data) => CustomScrollView(
              controller: ctrl,
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.sm,
                  ),
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search articles',
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
                        ref.read(kbSearchProvider.notifier).state = v,
                  ),
                ),
              ),
                if (search.isEmpty)
                  const SliverToBoxAdapter(child: _DraftsBanner()),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  sliver: search.isEmpty
                      ? _CategoriesSliver(data: data)
                      : _SearchResultsSliver(data: data, query: search),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoriesSliver extends StatelessWidget {
  const _CategoriesSliver({required this.data});
  final KBData data;

  static IconData _iconFor(String sf) {
    switch (sf) {
      case 'map.fill':
      case 'map':
        return Icons.map;
      case 'gearshape.fill':
      case 'gearshape':
        return Icons.settings;
      case 'books.vertical':
      case 'book':
      case 'book.fill':
        return Icons.menu_book;
      case 'star.fill':
        return Icons.star;
      case 'person.3.fill':
      case 'person.3':
      case 'people':
        return Icons.groups;
      case 'map.circle.fill':
      case 'map.circle':
      case 'public':
        return Icons.public;
      default:
        return Icons.bookmark;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SliverList.list(
      children: [
        const SectionHeader(title: 'Library', icon: Icons.menu_book),
        const SizedBox(height: AppSpacing.md),
        for (final cat in data.categories) ...[
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => GoRouter.of(context)
                .push('/knowledge/category/${cat.id}'),
            child: GlassCard(
              child: Row(
                children: [
                  SizedBox(
                    width: 44,
                    height: 44,
                    child: Icon(_iconFor(cat.icon),
                        color: AppColors.accentPrimary, size: 26),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(cat.title, style: AppTypography.headline),
                        const SizedBox(height: 2),
                        Text(
                          '${data.articlesIn(cat.id).length} article${data.articlesIn(cat.id).length == 1 ? '' : 's'}',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right,
                      color: AppColors.textDim, size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _SearchResultsSliver extends StatelessWidget {
  const _SearchResultsSliver({required this.data, required this.query});
  final KBData data;
  final String query;

  @override
  Widget build(BuildContext context) {
    final hits = data.index
        .search(query)
        .map((s) => data.articles[s])
        .whereType<KBArticle>()
        .toList();
    return SliverList.list(
      children: [
        const SectionHeader(title: 'Results', icon: Icons.search),
        const SizedBox(height: AppSpacing.md),
        if (hits.isEmpty)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text('No matches.', style: AppTypography.caption),
          )
        else
          for (final article in hits) ...[
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => GoRouter.of(context)
                  .push('/knowledge/article/${article.slug}'),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      article.categoryTitle.toUpperCase(),
                      style: AppTypography.mono.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: AppColors.accentPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(article.title, style: AppTypography.headline),
                    if (article.tags.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          for (final t in article.tags) TagChip(label: t),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
      ],
    );
  }
}

/// Tiny banner shown above the categories list to set the expectation that
/// every article is still a working draft. Reflects the iOS Swift reference's
/// "info: drafts in progress" tone and the user feedback that called for it.
class _DraftsBanner extends StatelessWidget {
  const _DraftsBanner();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md, 0, AppSpacing.md, AppSpacing.md,
      ),
      child: GlassCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Icon(Icons.edit_note,
                  color: AppColors.accentWarn, size: 18),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Drafts in progress', style: AppTypography.headline),
                  const SizedBox(height: 2),
                  Text(
                    'Every article here is a working draft. Writing takes '
                    'time, so expect missing sections, light tables, and '
                    'updates over the next builds.',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
