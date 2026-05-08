import 'package:flutter/foundation.dart';

@immutable
class KBCategory {
  final String id;
  final String title;
  final String icon;
  final int order;
  final List<KBArticleRef> articles;

  const KBCategory({
    required this.id,
    required this.title,
    required this.icon,
    required this.order,
    required this.articles,
  });

  factory KBCategory.fromJson(Map<String, dynamic> j) => KBCategory(
    id: j['id'] as String,
    title: j['title'] as String,
    icon: j['icon'] as String,
    order: j['order'] as int,
    articles: (j['articles'] as List<dynamic>)
        .map((a) => KBArticleRef.fromJson(a as Map<String, dynamic>))
        .toList(),
  );
}

@immutable
class KBArticleRef {
  final String slug;
  final String title;
  final String file;
  final List<String> tags;
  final int order;

  const KBArticleRef({
    required this.slug,
    required this.title,
    required this.file,
    required this.tags,
    required this.order,
  });

  factory KBArticleRef.fromJson(Map<String, dynamic> j) => KBArticleRef(
    slug: j['slug'] as String,
    title: j['title'] as String,
    file: j['file'] as String,
    tags: ((j['tags'] as List<dynamic>?) ?? const [])
        .map((e) => e as String)
        .toList(),
    order: j['order'] as int,
  );
}

@immutable
class KBArticle {
  final String slug;
  final String title;
  final String categoryId;
  final String categoryTitle;
  final List<String> tags;
  final String markdown;
  final int order;

  const KBArticle({
    required this.slug,
    required this.title,
    required this.categoryId,
    required this.categoryTitle,
    required this.tags,
    required this.markdown,
    required this.order,
  });
}

class KBIndex {
  final Map<String, Set<String>> _tokensToSlugs = {};
  final Map<String, String> _slugTitles = {};

  void add(KBArticle article) {
    _slugTitles[article.slug] = article.title;
    _index(article.title, article.slug);
    _index(article.markdown, article.slug);
    for (final tag in article.tags) {
      _index(tag, article.slug);
    }
    _index(article.categoryTitle, article.slug);
  }

  void _index(String text, String slug) {
    for (final token in _tokens(text)) {
      _tokensToSlugs.putIfAbsent(token, () => <String>{}).add(slug);
    }
  }

  Iterable<String> _tokens(String text) sync* {
    final lower = text.toLowerCase();
    final buf = StringBuffer();
    for (final c in lower.codeUnits) {
      final isAlphaNum = (c >= 0x30 && c <= 0x39) ||
          (c >= 0x41 && c <= 0x5A) ||
          (c >= 0x61 && c <= 0x7A);
      if (isAlphaNum) {
        buf.writeCharCode(c);
      } else if (buf.isNotEmpty) {
        if (buf.length >= 2) yield buf.toString();
        buf.clear();
      }
    }
    if (buf.length >= 2) yield buf.toString();
  }

  List<String> search(String query) {
    final tokens = _tokens(query).toList();
    if (tokens.isEmpty) return const [];
    final sets = <Set<String>>[];
    for (final t in tokens) {
      final matches = _tokensToSlugs.keys.where((k) => k.startsWith(t));
      final union = <String>{};
      for (final k in matches) {
        union.addAll(_tokensToSlugs[k] ?? const {});
      }
      sets.add(union);
    }
    if (sets.isEmpty) return const [];
    final result = sets.first.toSet();
    for (final s in sets.skip(1)) {
      result.removeWhere((e) => !s.contains(e));
    }
    final list = result.toList();
    list.sort((a, b) => (_slugTitles[a] ?? a).compareTo(_slugTitles[b] ?? b));
    return list;
  }
}
