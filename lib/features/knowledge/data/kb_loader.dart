import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/logging.dart';
import '../domain/kb_models.dart';

class KBData {
  final List<KBCategory> categories;
  final Map<String, KBArticle> articles;
  final KBIndex index;

  const KBData({
    required this.categories,
    required this.articles,
    required this.index,
  });

  List<KBArticle> articlesIn(String categoryId) {
    final list = articles.values
        .where((a) => a.categoryId == categoryId)
        .toList();
    list.sort((a, b) => a.order.compareTo(b.order));
    return list;
  }

  static Future<KBData> load() async {
    final manifestRaw =
        await rootBundle.loadString('assets/knowledge/manifest.json');
    final manifest = jsonDecode(manifestRaw) as Map<String, dynamic>;
    final categories = (manifest['categories'] as List<dynamic>)
        .map((c) => KBCategory.fromJson(c as Map<String, dynamic>))
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));

    final articles = <String, KBArticle>{};
    final index = KBIndex();
    for (final cat in categories) {
      for (final ref in cat.articles) {
        final assetPath = 'assets/knowledge/${ref.file}';
        String md;
        try {
          md = await rootBundle.loadString(assetPath);
        } catch (e, st) {
          // R15: keep the placeholder, but don't swallow the failure silently.
          logError(e, st);
          md = '# ${ref.title}\n\n(Article content missing.)';
        }
        final article = KBArticle(
          slug: ref.slug,
          title: ref.title,
          categoryId: cat.id,
          categoryTitle: cat.title,
          tags: ref.tags,
          markdown: md,
          order: ref.order,
        );
        articles[article.slug] = article;
        index.add(article);
      }
    }
    return KBData(
      categories: categories,
      articles: articles,
      index: index,
    );
  }
}

final kbDataProvider = FutureProvider<KBData>((ref) => KBData.load());
