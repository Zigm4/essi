import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_integrity.dart';

void main() {
  group('sha256Hex', () {
    test('known NIST vector for "abc"', () {
      final bytes = Uint8List.fromList(utf8.encode('abc'));
      expect(
        sha256Hex(bytes),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    test('empty input vector', () {
      expect(
        sha256Hex(Uint8List(0)),
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });

  group('verifyBytes', () {
    final bytes = Uint8List.fromList(utf8.encode('the quick brown fox'));
    final good = sha256Hex(bytes);

    test('accepts the matching digest', () {
      expect(verifyBytes(bytes, good), isTrue);
    });

    test('is case-insensitive and trims', () {
      expect(verifyBytes(bytes, '  ${good.toUpperCase()}  '), isTrue);
    });

    test('rejects a wrong digest', () {
      final wrong = good.replaceRange(0, 1, good[0] == 'a' ? 'b' : 'a');
      expect(verifyBytes(bytes, wrong), isFalse);
    });

    test('rejects a truncated / wrong-length digest', () {
      expect(verifyBytes(bytes, good.substring(0, 10)), isFalse);
      expect(verifyBytes(bytes, ''), isFalse);
    });

    test('rejects when the bytes were tampered with', () {
      final tampered = Uint8List.fromList([...bytes, 0x21]);
      expect(verifyBytes(tampered, good), isFalse);
    });
  });
}
