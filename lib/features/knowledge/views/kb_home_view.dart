import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../captures/widgets/tag_chip.dart';
import '../data/kb_loader.dart';
import '../domain/kb_models.dart';

final kbSearchProvider = StateProvider<String>((ref) => '');

class KBHomeView extends ConsumerWidget {
  const KBHomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(kbDataProvider);
    final search = ref.watch(kbSearchProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('Knowledge', style: AppTypography.headline),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              'Failed to load Knowledge: $e',
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) => CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    MediaQuery.paddingOf(context).top +
                        kToolbarHeight +
                        AppSpacing.sm,
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
