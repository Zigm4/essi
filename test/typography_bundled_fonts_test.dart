import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/design_system/typography.dart';

/// F21/F74: type is bundled as assets and resolved by family name (no runtime
/// fetch from fonts.gstatic.com). These families must match the pubspec
/// `fonts:` declarations exactly, so guard them against accidental drift.
void main() {
  test('bundled font family names are the pubspec-declared families', () {
    expect(AppTypography.fontSans, 'Inter');
    expect(AppTypography.fontMono, 'JetBrainsMono');
    expect(AppTypography.fontRounded, 'Quicksand');
  });

  test('sans styles use the bundled Inter family', () {
    for (final style in <TextStyle>[
      AppTypography.title,
      AppTypography.headline,
      AppTypography.body,
      AppTypography.caption,
    ]) {
      expect(style.fontFamily, AppTypography.fontSans);
    }
  });

  test('mono styles use the bundled JetBrainsMono family', () {
    for (final style in <TextStyle>[
      AppTypography.mono,
      AppTypography.terminal,
    ]) {
      expect(style.fontFamily, AppTypography.fontMono);
    }
  });

  test('display style uses the bundled Quicksand family', () {
    expect(AppTypography.display.fontFamily, AppTypography.fontRounded);
  });
}
