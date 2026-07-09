import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

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
import 'link_editor_view.dart';

class LinkDetailView extends ConsumerWidget {
  const LinkDetailView({super.key, required this.linkId});

  final String linkId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linksAsync = ref.watch(linksStreamProvider);
    final link = linksAsync.valueOrNull?.firstWhere(
      (l) => l.id == linkId,
      orElse: () => _placeholderLink,
    );
    if (link == null || link.id.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bgDeepest,
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final isDiscord = link.url.contains('discord');
    final uri = Uri.tryParse(link.url.trim());
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Link', style: AppTypography.headline),
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
                builder: (_) => LinkEditorView(link: link),
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
                    if (link.title.isNotEmpty) ...[
                      Text(link.title, style: AppTypography.title),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    GestureDetector(
                      onTap: uri == null
                          ? null
                          : () =>
                              launchUrl(uri, mode: LaunchMode.externalApplication),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            isDiscord ? Icons.forum_outlined : Icons.link,
                            color: uri != null
                                ? AppColors.accentPrimary
                                : AppColors.textSecondary,
                            size: 18,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              link.url,
                              style: AppTypography.mono.copyWith(
                                fontSize: 13,
                                color: uri != null
                                    ? AppColors.accentSecondary
                                    : AppColors.textSecondary,
                                decoration: uri != null
                                    ? TextDecoration.underline
                                    : TextDecoration.none,
                                decorationColor: AppColors.accentSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (link.note.isNotEmpty) ...[
                      Container(
                        height: 1,
                        margin: const EdgeInsets.symmetric(
                          vertical: AppSpacing.md,
                        ),
                        color: AppColors.borderSubtle,
                      ),
                      UnderdeckMarkdownView(markdown: link.note),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Text(
                    formatRelativeDate(link.updatedAt),
                    style: AppTypography.caption,
                  ),
                  const Spacer(),
                  if (link.tags.isNotEmpty)
                    Flexible(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        reverse: true,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            for (final t in link.tags) ...[
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

final _placeholderLink = LinkModel(
  id: '',
  title: '',
  url: '',
  note: '',
  createdAt: DateTime.fromMillisecondsSinceEpoch(0),
  updatedAt: DateTime.fromMillisecondsSinceEpoch(0),
  tags: const [],
);
