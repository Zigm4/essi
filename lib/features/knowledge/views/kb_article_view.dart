import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_constants.dart';
import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/neon_button.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../../captures/widgets/tag_chip.dart';
import '../../favorites/data/favorites_repository.dart';
import '../../favorites/widgets/favorite_button.dart';
import '../../menu/views/contact_view.dart';
import '../data/kb_loader.dart';
import '../domain/kb_models.dart';
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
        actions: [
          FavoriteButton(
            kind: FavoriteKind.kbArticle,
            id: slug,
            icon: Icons.bookmark_border_rounded,
            activeIcon: Icons.bookmark_rounded,
            tooltip: 'Bookmark article',
            activeColor: AppColors.accentPrimary,
          ),
        ],
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
                  if (article.isPlaceholder) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _ContributeIntelCard(article: article),
                  ],
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

/// Call-to-action shown on draft/placeholder KB articles inviting the
/// community to fill the missing sections. Routes to the in-app Contact form
/// pre-filled with the article slug, or opens the Discord invite.
class _ContributeIntelCard extends ConsumerWidget {
  const _ContributeIntelCard({required this.article});

  final KBArticle article;

  String get _prefill =>
      "Contributing intel for the KB article \"${article.title}\" "
      "(${article.slug}).\n\n"
      "Section: \n"
      "What I know: \n";

  Future<void> _openContact(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ContactView(initialMessage: _prefill),
      ),
    );
  }

  Future<void> _openDiscord(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    final ok = await launchUrl(
      Uri.parse(AppConstants.discordInviteUrl),
      mode: LaunchMode.externalApplication,
    );
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Couldn't open Discord — try again"),
          backgroundColor: AppColors.accentDanger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Contribute intel',
            icon: Icons.volunteer_activism,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This article is still a draft. If you have first-hand info, '
            'corrections or screenshots, send them in and help fill it out.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.md),
          NeonButton(
            title: 'Contribute intel',
            icon: Icons.mail_outline,
            onPressed: () => _openContact(context, ref),
          ),
          const SizedBox(height: AppSpacing.sm),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _openDiscord(context, ref),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.forum_outlined,
                      color: AppColors.accentSecondary, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    'or discuss on Discord',
                    style: AppTypography.body.copyWith(
                      color: AppColors.accentSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
