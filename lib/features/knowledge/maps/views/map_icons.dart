import 'package:flutter/material.dart';

import '../domain/map_enums.dart';

/// Single resolver from the closed [MapIcon] enum to a Material glyph.
///
/// The content schema uses a *closed* icon enum (must-ignore parsed — unknown
/// wire values already collapse to [MapIcon.unknown] upstream), so the gallery
/// never has to switch on free-form SF-Symbol strings the way the KB category
/// list does. One resolver, one place to extend when the enum grows.
IconData mapIconData(MapIcon icon) {
  switch (icon) {
    case MapIcon.map:
      return Icons.map;
    case MapIcon.dungeon:
      return Icons.castle;
    case MapIcon.station:
      return Icons.hub;
    case MapIcon.sphere:
      return Icons.public;
    case MapIcon.sector:
      return Icons.grid_on;
    case MapIcon.unknown:
      return Icons.travel_explore;
  }
}
