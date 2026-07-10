import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../core/internal_link.dart';
import '../../../core/logging.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/typography.dart';

class KBMarkdownView extends StatelessWidget {
  const KBMarkdownView({super.key, required this.markdown});

  final String markdown;

  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: markdown,
      onTapLink: (text, href, title) {
        if (href == null) return;
        // Internal `underdeck://` links jump to a KB article / map in-app; R4:
        // external links are allow-listed before being handed to the OS (§4.8).
        resolveLink(context, href);
      },
      // R3: flutter_markdown_plus replaced sizedImageBuilder with imageBuilder
      // (uri, title, alt) — it no longer surfaces a per-image width, so the
      // constrained decode below falls back to the layout width from
      // MediaQuery (the same value the old builder used when no explicit
      // width was present in the markdown).
      imageBuilder: (uri, title, alt) {
        final raw = uri.toString();
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
          // R7: reject insecure image URLs outright — KB images are trusted
          // https assets; anything on plain http is broken/unsafe.
          if (!raw.startsWith('https://')) return _brokenImageTile();
          return Image.network(
            raw,
            errorBuilder: (context, error, stack) {
              logError(error, stack);
              return _brokenImageTile();
            },
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return const SizedBox(
                height: 120,
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              );
            },
          );
        }
        final clean = raw.startsWith('./') ? raw.substring(2) : raw;
        final base = clean.startsWith('images/') ? clean : 'images/$clean';
        // R7: decode at display resolution so oversized PNGs (the KB ships a
        // 4086×4086 asset) don't OOM low-end Android devices.
        final dpr = MediaQuery.devicePixelRatioOf(context);
        final displayWidth = MediaQuery.sizeOf(context).width;
        final cacheWidth = (displayWidth * dpr).round().clamp(1, 4096);
        return Image.asset(
          'assets/knowledge/$base',
          cacheWidth: cacheWidth,
          errorBuilder: (context, error, stack) {
            logError(error, stack);
            return _brokenImageTile();
          },
        );
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

/// R7: small placeholder shown when a KB image fails to load or is rejected,
/// instead of an unbounded exception widget.
Widget _brokenImageTile() {
  return Container(
    height: 120,
    decoration: BoxDecoration(
      color: AppColors.bgGlass,
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: AppColors.borderSubtle),
    ),
    child: const Center(
      child: Icon(
        Icons.broken_image_outlined,
        color: AppColors.textSecondary,
        size: 28,
      ),
    ),
  );
}
