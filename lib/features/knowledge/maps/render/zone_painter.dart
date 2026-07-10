import 'package:flutter/rendering.dart';

import 'flat_map_render_model.dart';
import 'zone_paint_ops.dart';

/// Paints every zone's base fill / neon stroke / glow (and, when labels are
/// visible, the label scrim behind each label). Static content — it repaints
/// only when the model or LOD flag changes, never on pan/zoom (the enclosing
/// [InteractiveViewer] transform handles those without a repaint).
///
/// The selected zone is drawn on top by a separate [SelectionPainter] so that
/// selection changes don't invalidate this (expensive) layer.
class ZonePainter extends CustomPainter {
  final FlatMapRender render;

  /// Whether labels (and therefore their scrims) are shown at the current zoom.
  final bool labelsVisible;

  const ZonePainter({required this.render, required this.labelsVisible});

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = zoneStrokeWidth(render.canvasSize);

    for (final item in render.items) {
      if (item.isMarker) {
        paintMarkerZone(
          canvas,
          item.markerCenter!,
          item.markerRadius,
          item.theme,
          selected: false,
        );
      } else if (item.fillPath != null) {
        paintPolygonZone(
          canvas,
          item.fillPath!,
          item.theme,
          strokeWidth: strokeWidth,
          selected: false,
        );
      }
    }

    // Label scrims sit above the fills but below the (separately painted) text,
    // so glyphs stay legible over both the background image and the zone fills.
    if (labelsVisible) {
      for (final item in render.items) {
        final label = item.label;
        if (label == null) continue;
        canvas.drawRRect(
          label.scrim,
          Paint()..color = item.theme.background.withValues(alpha: 0.72),
        );
      }
    }
  }

  @override
  bool shouldRepaint(ZonePainter old) =>
      old.render != render || old.labelsVisible != labelsVisible;
}
