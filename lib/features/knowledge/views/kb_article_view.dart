import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../captures/widgets/tag_chip.dart';
import '../data/kb_loader.dart';
import '../widgets/kb_markdown_view.dart';

class KBArticleView extends ConsumerWidget {
  const KBArticleView({super.key, required this.slug});

  final String slug;

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
          dataAsync.valueOrNull?.articles[slug]?.title ?? '',
          style: AppTypography.headline,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load this article."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) {
            final article = data.articles[slug];
            if (article == null) {
              return Center(
                child: Text('Article not found.', style: AppTypography.caption),
              );
            }
            return PageScrollView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                MediaQuery.paddingOf(context).top +
                    kToolbarHeight +
                    AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.categoryTitle.toUpperCase(),
                    style: AppTypography.mono.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                      color: AppColors.accentPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(article.title, style: AppTypography.title),
                  const SizedBox(height: AppSpacing.lg),
                  KBMarkdownView(markdown: article.markdown),
                  if (article.tags.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      height: 1,
                      color: AppColors.borderSubtle,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const SectionHeader(title: 'Tags', icon: Icons.tag),
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
            );
          },
        ),
      ),
    );
  }
}
