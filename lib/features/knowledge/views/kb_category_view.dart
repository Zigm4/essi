import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../captures/widgets/tag_chip.dart';
import '../data/kb_loader.dart';

class KBCategoryView extends ConsumerWidget {
  const KBCategoryView({super.key, required this.categoryId});

  final String categoryId;

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
      default:
        return Icons.bookmark;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(kbDataProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          dataAsync.valueOrNull?.categories
                  .firstWhere(
                    (c) => c.id == categoryId,
                    orElse: () => dataAsync.requireValue.categories.first,
                  )
                  .title ??
              '',
          style: AppTypography.headline,
        ),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load this category."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) {
            final cat = data.categories.firstWhere(
              (c) => c.id == categoryId,
              orElse: () => data.categories.first,
            );
            final articles = data.articlesIn(cat.id);
            return PageScrollView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                MediaQuery.paddingOf(context).top +
                    kToolbarHeight +
                    AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.xxl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (articles.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xxl,
                      ),
                      child: Text(
                        'No articles yet in this category.',
                        style: AppTypography.caption,
                      ),
                    )
                  else
                    for (final article in articles) ...[
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => context
                            .push('/knowledge/article/${article.slug}'),
                        child: GlassCard(
                          child: Row(
                            children: [
                              SizedBox(
                                width: 44,
                                height: 44,
                                child: Icon(
                                  _iconFor(cat.icon),
                                  color: AppColors.accentPrimary,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(article.title,
                                        style: AppTypography.headline),
                                    if (article.tags.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Wrap(
                                        spacing: 4,
                                        runSpacing: 4,
                                        children: [
                                          for (final t in article.tags)
                                            TagChip(label: t),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right,
                                  color: AppColors.textDim),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

