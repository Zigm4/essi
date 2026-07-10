import 'package:flutter/widgets.dart';

import '../domain/map_theme.dart';

/// Propagates the active [MapTheme] to descendant map widgets (the zone sheet
/// and its field renderer) without threading it through every constructor.
///
/// Use [MapThemeScope.of] where a theme is required, or [MapThemeScope.maybeOf]
/// where a sensible default ([MapTheme.defaults]) is acceptable off-map.
class MapThemeScope extends InheritedWidget {
  final MapTheme theme;

  const MapThemeScope({super.key, required this.theme, required super.child});

  static MapTheme of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<MapThemeScope>();
    assert(scope != null, 'MapThemeScope.of() called with no MapThemeScope');
    return scope!.theme;
  }

  static MapTheme maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<MapThemeScope>()?.theme ??
      MapTheme.defaults;

  @override
  bool updateShouldNotify(MapThemeScope old) =>
      !identical(old.theme, theme);
}
