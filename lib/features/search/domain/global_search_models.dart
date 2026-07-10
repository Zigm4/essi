import 'package:flutter/foundation.dart';

/// The federated sources a single global-search query fans out to (AUDIT-V2
/// §6.4). The *declaration order* of this enum is also the display order of the
/// result groups on the search surface — keep them intentional.
enum SearchSource {
  mapZone,
  kbArticle,
  job,
  wallet,
  capture,
  mapPin,
}

extension SearchSourceLabel on SearchSource {
  /// Section header shown above the group of results for this source.
  String get groupTitle {
    switch (this) {
      case SearchSource.mapZone:
        return 'Map zones';
      case SearchSource.kbArticle:
        return 'Knowledge base';
      case SearchSource.job:
        return 'Jobs';
      case SearchSource.wallet:
        return 'Wallets';
      case SearchSource.capture:
        return 'Notes & links';
      case SearchSource.mapPin:
        return 'My map notes';
    }
  }
}

/// Fixed display order for the result groups — the enum's own value order.
const List<SearchSource> kSearchSourceOrder = SearchSource.values;

/// Default per-group cap: each source shows at most this many rows, with a
/// "more" affordance when it has extra hits.
const int kSearchGroupCap = 5;

/// One source's slice of the federated results: the (capped) rows to render plus
/// the pre-cap [total] so the UI can show an accurate "+N more".
@immutable
class SearchGroup<T> {
  const SearchGroup({
    required this.source,
    required this.visible,
    required this.total,
  });

  final SearchSource source;

  /// The rows to render — never longer than the cap.
  final List<T> visible;

  /// How many hits this source produced *before* capping.
  final int total;

  /// Hits hidden behind the cap (never negative).
  int get hiddenCount {
    final n = total - visible.length;
    return n < 0 ? 0 : n;
  }

  /// True when the source produced more hits than are shown.
  bool get hasMore => hiddenCount > 0;
}

/// Federate per-source result lists into ordered, capped, non-empty groups.
///
/// Pure and generic (no Flutter/UI dependency beyond value types) so it is the
/// single unit-testable core of the search surface: it fixes group order
/// ([kSearchSourceOrder]), drops empty sources, and caps each group to [cap]
/// while preserving each source's own hit ordering. A non-positive [cap] shows
/// every hit (no capping).
List<SearchGroup<T>> federateSearchResults<T>(
  Map<SearchSource, List<T>> bySource, {
  int cap = kSearchGroupCap,
}) {
  final groups = <SearchGroup<T>>[];
  for (final source in kSearchSourceOrder) {
    final items = bySource[source] ?? const [];
    if (items.isEmpty) continue;
    final capped = cap > 0 && items.length > cap;
    final visible = List<T>.unmodifiable(capped ? items.sublist(0, cap) : items);
    groups.add(SearchGroup(source: source, visible: visible, total: items.length));
  }
  return groups;
}

/// Total hits across every group (pre-cap) — drives the empty state and the
/// result-count header.
int totalHitCount<T>(List<SearchGroup<T>> groups) =>
    groups.fold(0, (sum, g) => sum + g.total);
