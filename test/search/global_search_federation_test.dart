import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/search/domain/global_search_models.dart';

void main() {
  group('federateSearchResults', () {
    test('empty input yields no groups', () {
      final groups = federateSearchResults<String>({});
      expect(groups, isEmpty);
      expect(totalHitCount(groups), 0);
    });

    test('drops sources with no hits', () {
      final groups = federateSearchResults<String>({
        SearchSource.mapZone: ['a', 'b'],
        SearchSource.kbArticle: const [],
        SearchSource.job: ['c'],
      });
      expect(groups.map((g) => g.source),
          [SearchSource.mapZone, SearchSource.job]);
    });

    test('preserves the fixed source order regardless of map order', () {
      // Insert sources out of enum order; output must follow kSearchSourceOrder.
      final groups = federateSearchResults<String>({
        SearchSource.mapPin: ['p'],
        SearchSource.job: ['j'],
        SearchSource.mapZone: ['z'],
      });
      expect(
        groups.map((g) => g.source),
        [SearchSource.mapZone, SearchSource.job, SearchSource.mapPin],
      );
    });

    test('caps each group and reports pre-cap total + overflow', () {
      final items = List.generate(9, (i) => 'item$i');
      final groups = federateSearchResults<String>(
        {SearchSource.job: items},
        cap: 5,
      );
      final g = groups.single;
      expect(g.visible.length, 5);
      expect(g.visible, items.sublist(0, 5)); // order preserved, first N kept
      expect(g.total, 9);
      expect(g.hiddenCount, 4);
      expect(g.hasMore, isTrue);
    });

    test('group at exactly the cap has no overflow', () {
      final items = List.generate(5, (i) => i);
      final g = federateSearchResults<int>(
        {SearchSource.wallet: items},
        cap: 5,
      ).single;
      expect(g.visible.length, 5);
      expect(g.total, 5);
      expect(g.hiddenCount, 0);
      expect(g.hasMore, isFalse);
    });

    test('default cap is kSearchGroupCap', () {
      final items = List.generate(kSearchGroupCap + 3, (i) => i);
      final g = federateSearchResults<int>({SearchSource.kbArticle: items})
          .single;
      expect(g.visible.length, kSearchGroupCap);
      expect(g.hiddenCount, 3);
    });

    test('non-positive cap disables capping', () {
      final items = List.generate(20, (i) => i);
      final g = federateSearchResults<int>(
        {SearchSource.mapZone: items},
        cap: 0,
      ).single;
      expect(g.visible.length, 20);
      expect(g.hasMore, isFalse);
    });

    test('visible list is unmodifiable', () {
      final g = federateSearchResults<int>({
        SearchSource.job: [1, 2, 3],
      }).single;
      expect(() => g.visible.add(4), throwsUnsupportedError);
    });

    test('totalHitCount sums pre-cap totals across groups', () {
      final groups = federateSearchResults<int>(
        {
          SearchSource.mapZone: List.generate(7, (i) => i),
          SearchSource.job: [1, 2],
        },
        cap: 3,
      );
      // 7 + 2 pre-cap, even though only 3 + 2 are visible.
      expect(totalHitCount(groups), 9);
    });

    test('every source carries a non-empty group title', () {
      for (final s in SearchSource.values) {
        expect(s.groupTitle, isNotEmpty);
      }
    });
  });
}
