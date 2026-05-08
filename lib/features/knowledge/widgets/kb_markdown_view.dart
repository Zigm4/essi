import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/typography.dart';

class KBMarkdownView extends StatelessWidget {
  const KBMarkdownView({super.key, required this.markdown});

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
      imageBuilder: (uri, title, alt) {
        final raw = uri.toString();
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
          return Image.network(raw);
        }
        // Resolve relative paths into Flutter assets/knowledge/...
        final clean = raw.startsWith('./') ? raw.substring(2) : raw;
        final base = clean.startsWith('images/') ? clean : 'images/$clean';
        return Image.asset('assets/knowledge/$base');
      },
      styleSheet: MarkdownStyleSheet(
        p: AppTypography.body,
        h1: AppTypography.title.copyWith(fontSize: 24),
        h2: AppTypography.headline.copyWith(fontSize: 19),
        h3: AppTypography.headline,
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
