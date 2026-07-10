import 'dart:ui';

import '../domain/map_geometry.dart';

/// Builds a canvas-pixel-space [Path] for a flat [PolygonGeometry].
///
/// The path uses [PathFillType.evenOdd] so subsequent rings punch **holes** in
/// the outline (first ring = outline, rest = holes). Even-odd is what makes both
/// `Path.contains` (hit-testing) and the fill/stroke painters agree on holes
/// without any manual winding bookkeeping.
///
/// Returns an empty path (never `null`) for a polygon with no usable rings, so
/// callers can treat the result uniformly.
Path polygonPath(PolygonGeometry g) {
  final path = Path()..fillType = PathFillType.evenOdd;
  for (final ring in g.rings) {
    if (ring.length < 3) continue; // a ring needs 3+ points to enclose area
    path.addPolygon(ring, true);
  }
  return path;
}
