import 'package:flutter/rendering.dart';

import 'flat_map_render_model.dart';

/// Paints zone labels from precomputed [TextPainter]s. Labels scale with the map
/// (canvas space); below [FlatMapRender.labelLodScale] they are hidden entirely
/// (LOD) rather than rendered as an unreadable smear.
///
/// The matching scrim/halo behind each glyph is drawn one layer down by
/// [ZonePainter] (from the same [ZoneLabelLayout]), so text stays legible over
/// the background image — a guarantee the theme alone cannot make.
class LabelPainter extends CustomPainter {
  final FlatMapRender render;

  /// Gates the whole layer: `false` below the LOD scale threshold.
  final bool visible;

  const LabelPainter({required this.render, required this.visible});

  @override
  void paint(Canvas canvas, Size size) {
    if (!visible) return;
    for (final item in render.items) {
      final label = item.label;
      if (label == null) continue;
      label.painter.paint(canvas, label.topLeft);
    }
  }

  @override
  bool shouldRepaint(LabelPainter old) =>
      old.render != render || old.visible != visible;
}
