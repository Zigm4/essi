import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/typography.dart';

class UnderdeckMarkdownView extends StatelessWidget {
  const UnderdeckMarkdownView({super.key, required this.markdown});

  final String markdown;

  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: markdown,
      onTapLink: (text, href, title) async {
        if (href == null) return;
        final uri = Uri.tryParse(href);
        if (uri == null) return;
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      },
      styleSheet: MarkdownStyleSheet(
        p: AppTypography.body,
        h1: AppTypography.title,
        h2: AppTypography.headline,
        h3: AppTypography.headline.copyWith(fontSize: 15),
        em: AppTypography.body.copyWith(fontStyle: FontStyle.italic),
        strong: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
        a: AppTypography.body.copyWith(
          color: AppColors.accentPrimary,
          decoration: TextDecoration.underline,
          decorationColor: AppColors.accentPrimary,
        ),
        code: AppTypography.mono.copyWith(
          fontSize: 13,
          color: AppColors.accentSecondary,
          backgroundColor: AppColors.bgGlass,
        ),
        codeblockDecoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        codeblockPadding: const EdgeInsets.all(8),
        blockquote: AppTypography.body.copyWith(
          color: AppColors.textSecondary,
          fontStyle: FontStyle.italic,
        ),
        blockquoteDecoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: AppColors.accentPrimary, width: 3),
          ),
        ),
        listBullet: AppTypography.body,
      ),
    );
  }
}
