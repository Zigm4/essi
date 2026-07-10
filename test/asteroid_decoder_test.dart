import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/asteroid/domain/asteroid_models.dart';

/// R12 — table tests for [AsteroidDecoder.analyze] / [validationRules], the
/// pure decoding logic behind the asteroid tool. Tables are built inline so no
/// asset bundle is needed.

AsteroidEntry _e(String name,
        {double? multiplier, int? value, bool? pvp}) =>
    AsteroidEntry(
      name: name,
      emoji: '*',
      multiplier: multiplier,
      value: value,
      pvp: pvp,
    );

/// A tables fixture with just enough keys to exercise value/alert math.
final _tables = AsteroidTables(
  type: {'1': _e('Rock')},
  size: {'2': _e('Large', multiplier: 2.0), '5': _e('Huge', multiplier: 1.0)},
  structure: {'3': _e('Sparse'), '5': _e('Dense')},
  salvage: {'4': _e('Scrap')},
  law: {'6': _e('Patrolled'), '0': _e('Lawless', pvp: true)},
  resource: {
    '6': _e('Star-Tar', value: 5),
    '7': _e('Iron', value: 10),
    '8': _e('Gold', value: 20),
    '9': _e('Rare Gas', value: 30),
  },
);

void main() {
  group('AsteroidDecoder.analyze', () {
    test('decodes positions, resource value, and a rare-gas alert', () {
      final a = AsteroidDecoder.analyze('123456789', _tables);
      expect(a.typeKey, '1');
      expect(a.type.name, 'Rock');
      expect(a.sizeKey, '2');
      expect(a.wealth, 5);
      expect(a.lawKey, '6');
      expect(a.resources.map((r) => r.key), ['7', '8', '9']);
      // (10 + 20 + 30) * multiplier 2.0 * wealth 5 = 600.
      expect(a.resourceValue, 600.0);
      // structure '3' < 5 -> no infra alert; law '6' -> no combat; has '9'.
      expect(a.alerts, hasLength(1));
      expect(a.alerts.single.level, AsteroidAlertLevel.high);
    });

    test('emits infra + star-tar + combat alerts for a lawless dense field', () {
      // struct '5' (>=5), law '0' (lawless+pvp), resources 6/6/6 (star-tar).
      final a = AsteroidDecoder.analyze('155030666', _tables);
      expect(a.wealth, 3);
      // (5 + 5 + 5) * multiplier 1.0 * wealth 3 = 45.
      expect(a.resourceValue, 45.0);
      final levels = a.alerts.map((x) => x.level).toList();
      expect(levels, [
        AsteroidAlertLevel.info, // significant infrastructure
        AsteroidAlertLevel.critical, // star-tar (lawKey 0 + resource 6)
        AsteroidAlertLevel.warning, // combat-enabled zone (pvp)
      ]);
      final starTar = a.alerts[1];
      expect(starTar.message, contains('3-3')); // count-wealth
    });

    test('unknown keys fall back to AsteroidEntry.unknown', () {
      final a = AsteroidDecoder.analyze('900000000', _tables);
      expect(a.type.name, 'Unknown');
      expect(a.size.name, 'Unknown');
      expect(a.resourceValue, 0.0); // unknown resources contribute value 0
    });

    test('rejects a non-9-length id', () {
      expect(
        () => AsteroidDecoder.analyze('12345', _tables),
        throwsA(isA<AsteroidDecodeException>()),
      );
    });

    test('rejects a non-numeric id', () {
      expect(
        () => AsteroidDecoder.analyze('12345678x', _tables),
        throwsA(isA<AsteroidDecodeException>()),
      );
    });
  });

  group('AsteroidDecoder.validationRules / isFullyValid', () {
    Map<String, bool> byId(String raw) => {
          for (final r in AsteroidDecoder.validationRules(raw)) r.id: r.isSatisfied,
        };

    test('a well-formed id satisfies every rule', () {
      expect(AsteroidDecoder.isFullyValid('123456789'), isTrue);
      final rules = byId('123456789');
      expect(rules.values.every((v) => v), isTrue);
    });

    test('non-digits fail digits/length and position rules', () {
      final rules = byId('12abc6789');
      expect(rules['digits'], isFalse);
      expect(rules['length'], isFalse); // length gate requires allDigits
      expect(AsteroidDecoder.isFullyValid('12abc6789'), isFalse);
    });

    test('wrong length fails the length rule only when digits pass', () {
      final rules = byId('12345678'); // 8 digits
      expect(rules['digits'], isTrue);
      expect(rules['length'], isFalse);
    });

    test('position 1 must be 1 (asteroid marker)', () {
      expect(byId('023456789')['type'], isFalse);
      expect(byId('123456789')['type'], isTrue);
    });

    test('a zero in a resource slot fails the rss rule', () {
      expect(byId('123456709')['rss'], isFalse); // position 8 is 0
      expect(byId('123456789')['rss'], isTrue);
    });

    test('an empty id satisfies nothing', () {
      expect(byId('').values.every((v) => !v), isTrue);
    });
  });
}
