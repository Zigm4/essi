import 'package:flutter/rendering.dart';

import 'flat_map_render_model.dart';
import 'zone_paint_ops.dart';

/// Paints ONLY the currently selected zone, highlighted. Its own layer (above
/// [ZonePainter], below the labels) so that changing the selection repaints just
/// this cheap layer — never the full zone layer or the background.
///
/// [shouldRepaint] compares by the selected zone's identity, so tapping the same
/// zone twice or rebuilding with an unchanged selection is a no-op.
class SelectionPainter extends CustomPainter {
  final ZoneRenderItem? selected;
  final Size canvasSize;

  const SelectionPainter({required this.selected, required this.canvasSize});

  @override
  void paint(Canvas canvas, Size size) {
    final item = selected;
    if (item == null) return;
    if (item.isMarker) {
      paintMarkerZone(
        canvas,
        item.markerCenter!,
        item.markerRadius,
        item.theme,
        selected: true,
      );
    } else if (item.fillPath != null) {
      paintPolygonZone(
        canvas,
        item.fillPath!,
        item.theme,
        strokeWidth: zoneStrokeWidth(canvasSize),
        selected: true,
      );
    }
  }

  @override
  bool shouldRepaint(SelectionPainter old) =>
      !identical(old.selected, selected) || old.canvasSize != canvasSize;
}
