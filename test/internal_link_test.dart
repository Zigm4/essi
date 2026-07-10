import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/core/internal_link.dart';

void main() {
  group('resolveInternalLink', () {
    test('underdeck://kb/<slug> → article route', () {
      expect(
        resolveInternalLink('underdeck://kb/mining-basics'),
        '/knowledge/article/mining-basics',
      );
    });

    test('underdeck://map/<id> → map route', () {
      expect(
        resolveInternalLink('underdeck://map/keth-9'),
        '/knowledge/maps/keth-9',
      );
    });

    test('underdeck://map/<id>?zone=<zone> → map route with zone query', () {
      expect(
        resolveInternalLink('underdeck://map/keth-9?zone=z-rustwind'),
        '/knowledge/maps/keth-9?zone=z-rustwind',
      );
    });

    test('scheme is case-insensitive', () {
      expect(
        resolveInternalLink('UNDERDECK://map/keth-9'),
        '/knowledge/maps/keth-9',
      );
    });

    test('external http(s) links are not internal → null (caller launches)', () {
      expect(resolveInternalLink('https://example.com/x'), isNull);
      expect(resolveInternalLink('http://example.com'), isNull);
    });

    test('mailto is not internal → null', () {
      expect(resolveInternalLink('mailto:pilot@underdeck.app'), isNull);
    });

    test('unknown / unsafe schemes → null (safe no-op)', () {
      expect(resolveInternalLink('javascript:alert(1)'), isNull);
      expect(resolveInternalLink('file:///etc/passwd'), isNull);
      expect(resolveInternalLink('tel:+100'), isNull);
    });

    test('unknown internal host → null', () {
      expect(resolveInternalLink('underdeck://wallet/abc'), isNull);
    });

    test('missing id segment → null', () {
      expect(resolveInternalLink('underdeck://map'), isNull);
      expect(resolveInternalLink('underdeck://kb'), isNull);
    });

    test('empty / junk → null', () {
      expect(resolveInternalLink(''), isNull);
      expect(resolveInternalLink('   '), isNull);
      expect(resolveInternalLink('not a uri at %%'), isNull);
    });

    test('leading/trailing whitespace is tolerated', () {
      expect(
        resolveInternalLink('  underdeck://map/keth-9  '),
        '/knowledge/maps/keth-9',
      );
    });

    test('a missing target still resolves to a valid route path', () {
      // The route matches and the view renders a "not found" state — never a
      // spinner. The resolver only produces the path; it does not verify
      // existence.
      expect(
        resolveInternalLink('underdeck://map/does-not-exist'),
        '/knowledge/maps/does-not-exist',
      );
      expect(
        resolveInternalLink('underdeck://kb/does-not-exist'),
        '/knowledge/article/does-not-exist',
      );
    });
  });
}
