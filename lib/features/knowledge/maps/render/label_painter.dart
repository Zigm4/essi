import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter/rendering.dart';

import 'flat_map_render_model.dart';

/// Alpha applied to a label whose zone fails the active filter (~30% opacity),
/// matching the fade [ZonePainter] applies to that zone's body/scrim.
const double _kDimAlpha = 0.30;

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

  /// Zone ids failing the active filter — their labels are dimmed to match the
  /// faded body [ZonePainter] draws. Empty when no filter is active.
  final Set<String> dimmed;

  const LabelPainter({
    required this.render,
    required this.visible,
    this.dimmed = const {},
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!visible) return;
    for (final item in render.items) {
      final label = item.label;
      if (label == null) continue;
      if (dimmed.contains(item.zoneId)) {
        final rect = label.scrim.outerRect.inflate(8);
        canvas.saveLayer(
          rect,
          Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: _kDimAlpha),
        );
        label.painter.paint(canvas, label.topLeft);
        canvas.restore();
      } else {
        label.painter.paint(canvas, label.topLeft);
      }
    }
  }

  @override
  bool shouldRepaint(LabelPainter old) =>
      old.render != render ||
      old.visible != visible ||
      !setEquals(old.dimmed, dimmed);
}
