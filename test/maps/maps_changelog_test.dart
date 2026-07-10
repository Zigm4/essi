import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';

void main() {
  group('MapChangelogEntry.tryParse', () {
    test('parses a bare string as notes with no version', () {
      final e = MapChangelogEntry.tryParse('  New crypt zone added.  ');
      expect(e, isNotNull);
      expect(e!.version, isNull);
      expect(e.notes, 'New crypt zone added.');
    });

    test('parses a {version, notes} object', () {
      final e = MapChangelogEntry.tryParse(
        {'version': ' 2.1 ', 'notes': ' Two new maps '},
      );
      expect(e!.version, '2.1');
      expect(e.notes, 'Two new maps');
    });

    test('object without version leaves version null', () {
      final e = MapChangelogEntry.tryParse({'notes': 'x'});
      expect(e!.version, isNull);
      expect(e.notes, 'x');
    });

    test('returns null for empty / missing notes and wrong types', () {
      expect(MapChangelogEntry.tryParse(''), isNull);
      expect(MapChangelogEntry.tryParse('   '), isNull);
      expect(MapChangelogEntry.tryParse({'version': '1.0'}), isNull);
      expect(MapChangelogEntry.tryParse({'notes': '  '}), isNull);
      expect(MapChangelogEntry.tryParse(42), isNull);
      expect(MapChangelogEntry.tryParse(null), isNull);
    });
  });

  group('parseChangelog (must-ignore)', () {
    test('absent / malformed manifest field yields an empty list', () {
      expect(parseChangelog(null), isEmpty);
      expect(parseChangelog(7), isEmpty);
      expect(parseChangelog(const <String, Object>{}), isEmpty);
    });

    test('a single string becomes one entry', () {
      final out = parseChangelog('Welcome to maps.');
      expect(out, hasLength(1));
      expect(out.single.notes, 'Welcome to maps.');
      expect(out.single.version, isNull);
    });

    test('a mixed list keeps valid items and skips junk', () {
      final out = parseChangelog([
        'Plain note',
        {'version': '2.0', 'notes': 'Structured note'},
        {'notes': ''}, // skipped: empty notes
        42, // skipped: wrong type
        {'version': '3.0'}, // skipped: no notes
      ]);
      expect(out, hasLength(2));
      expect(out[0].notes, 'Plain note');
      expect(out[1].version, '2.0');
      expect(out[1].notes, 'Structured note');
    });
  });

  group('shouldShowMapsChangelog (show once per version)', () {
    test('shows when there is changelog and no version seen yet', () {
      expect(
        shouldShowMapsChangelog(
          contentVersion: '2.0',
          lastSeenVersion: null,
          hasChangelog: true,
        ),
        isTrue,
      );
    });

    test('hidden once the current version has been acknowledged', () {
      expect(
        shouldShowMapsChangelog(
          contentVersion: '2.0',
          lastSeenVersion: '2.0',
          hasChangelog: true,
        ),
        isFalse,
      );
    });

    test('shows again after the content version advances', () {
      expect(
        shouldShowMapsChangelog(
          contentVersion: '2.1',
          lastSeenVersion: '2.0',
          hasChangelog: true,
        ),
        isTrue,
      );
    });

    test('never shows without changelog content', () {
      expect(
        shouldShowMapsChangelog(
          contentVersion: '2.0',
          lastSeenVersion: null,
          hasChangelog: false,
        ),
        isFalse,
      );
    });

    test('never shows for an empty content version', () {
      expect(
        shouldShowMapsChangelog(
          contentVersion: '',
          lastSeenVersion: null,
          hasChangelog: true,
        ),
        isFalse,
      );
    });
  });

  group('MapsManifest.fromJson changelog', () {
    Map<String, dynamic> base() => {
          'schemaVersion': 1,
          'contentVersion': '1.0',
          'minAppVersion': '1.0.0',
          'cdnBase': 'https://cdn.example.com',
          'maps': <dynamic>[],
        };

    test('omitted changelog is an empty list (old content unaffected)', () {
      final m = MapsManifest.fromJson(base());
      expect(m.changelog, isEmpty);
    });

    test('present changelog is parsed', () {
      final j = base()..['changelog'] = ['First note'];
      final m = MapsManifest.fromJson(j);
      expect(m.changelog, hasLength(1));
      expect(m.changelog.single.notes, 'First note');
    });
  });
}
