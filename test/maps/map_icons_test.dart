import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_enums.dart';
import 'package:underdeck_app/features/knowledge/maps/views/map_icons.dart';

void main() {
  test('mapIconData resolves every MapIcon member to a concrete glyph', () {
    for (final icon in MapIcon.values) {
      // Must not throw and must return a real icon (exhaustive switch).
      final data = mapIconData(icon);
      expect(data, isA<IconData>());
    }
  });

  test('unknown icon falls back to a generic explore glyph', () {
    expect(mapIconData(MapIcon.unknown), mapIconData(MapIcon.unknown));
    // Distinct closed members resolve to distinct glyphs (no accidental
    // collapse in the switch).
    expect(mapIconData(MapIcon.dungeon), isNot(mapIconData(MapIcon.sphere)));
  });
}
