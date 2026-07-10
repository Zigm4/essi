import 'package:flutter/rendering.dart';

import '../domain/map_theme.dart';

/// Canvas-space zone stroke width, scaled to the map. Strokes live in canvas
/// space (they zoom with the map); the fill alpha carries zone visibility when
/// zoomed out and the stroke sharpens up as you zoom in.
double zoneStrokeWidth(Size canvas) =>
    (canvas.shortestSide * 0.003).clamp(2.0, 14.0);

/// Fills + neon-strokes a polygon zone. [selected] swaps to the selected fill,
/// brightens the glow, and thickens the outline.
void paintPolygonZone(
  Canvas canvas,
  Path path,
  MapTheme theme, {
  required double strokeWidth,
  required bool selected,
}) {
  final fillColor = (selected ? theme.zoneSelectedFill : theme.zoneFill)
      .withValues(alpha: selected ? 0.60 : 0.42);
  canvas.drawPath(path, Paint()..color = fillColor);

  // Neon glow: a blurred stroke under the crisp one.
  canvas.drawPath(
    path,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth * (selected ? 1.8 : 1.3)
      ..color = theme.glow.withValues(alpha: selected ? 0.90 : 0.50)
      ..maskFilter = MaskFilter.blur(
        BlurStyle.normal,
        strokeWidth * (selected ? 2.4 : 1.5),
      ),
  );

  // Crisp outline.
  canvas.drawPath(
    path,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth * (selected ? 1.4 : 1.0)
      ..strokeJoin = StrokeJoin.round
      ..color = theme.zoneStroke,
  );
}

/// Draws a marker glyph (glow + disc + ring + inner cut-out).
void paintMarkerZone(
  Canvas canvas,
  Offset center,
  double radius,
  MapTheme theme, {
  required bool selected,
}) {
  canvas.drawCircle(
    center,
    radius * (selected ? 1.5 : 1.2),
    Paint()
      ..color = theme.glow.withValues(alpha: selected ? 0.90 : 0.50)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.6),
  );
  canvas.drawCircle(
    center,
    radius,
    Paint()..color = selected ? theme.zoneSelectedFill : theme.accent,
  );
  canvas.drawCircle(
    center,
    radius,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = radius * 0.18
      ..color = theme.zoneStroke,
  );
  canvas.drawCircle(center, radius * 0.30, Paint()..color = theme.background);
}
