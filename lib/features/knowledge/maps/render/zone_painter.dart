import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter/rendering.dart';

import 'flat_map_render_model.dart';
import 'zone_paint_ops.dart';

/// Alpha applied to a zone that fails the active filter (~30% opacity). Painted
/// via a `saveLayer` so the zone's whole glyph (fill + glow + stroke + scrim)
/// fades together, not each element independently.
const double _kDimAlpha = 0.30;

/// Paints every zone's base fill / neon stroke / glow (and, when labels are
/// visible, the label scrim behind each label). Static content — it repaints
/// only when the model, LOD flag, or the [dimmed] filter set changes, never on
/// pan/zoom (the enclosing [InteractiveViewer] transform handles those without a
/// repaint).
///
/// The selected zone is drawn on top by a separate [SelectionPainter] so that
/// selection changes don't invalidate this (expensive) layer.
class ZonePainter extends CustomPainter {
  final FlatMapRender render;

  /// Whether labels (and therefore their scrims) are shown at the current zoom.
  final bool labelsVisible;

  /// Zone ids failing the active filter — drawn dimmed (~30% opacity). Empty
  /// when no filter is active.
  final Set<String> dimmed;

  const ZonePainter({
    required this.render,
    required this.labelsVisible,
    this.dimmed = const {},
  });

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = zoneStrokeWidth(render.canvasSize);

    for (final item in render.items) {
      _maybeDimmed(canvas, item, strokeWidth, () {
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
      });
    }

    // Label scrims sit above the fills but below the (separately painted) text,
    // so glyphs stay legible over both the background image and the zone fills.
    if (labelsVisible) {
      for (final item in render.items) {
        final label = item.label;
        if (label == null) continue;
        void paintScrim() => canvas.drawRRect(
              label.scrim,
              Paint()..color = item.theme.background.withValues(alpha: 0.72),
            );
        _maybeDimmed(canvas, item, strokeWidth, paintScrim);
      }
    }
  }

  /// Runs [draw] inside a 30%-opacity layer when [item] is filtered out,
  /// otherwise draws it at full opacity. The layer bounds inflate past the
  /// geometry so the neon glow is not clipped.
  void _maybeDimmed(
    Canvas canvas,
    ZoneRenderItem item,
    double strokeWidth,
    VoidCallback draw,
  ) {
    if (!dimmed.contains(item.zoneId)) {
      draw();
      return;
    }
    final margin = strokeWidth * 4 + item.markerRadius + 8;
    canvas.saveLayer(
      item.bounds.inflate(margin),
      Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: _kDimAlpha),
    );
    draw();
    canvas.restore();
  }

  @override
  bool shouldRepaint(ZonePainter old) =>
      old.render != render ||
      old.labelsVisible != labelsVisible ||
      !setEquals(old.dimmed, dimmed);
}
