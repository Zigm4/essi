import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/widgets.dart';

import '../../../../core/logging.dart';
import '../domain/map_theme.dart';

/// Absolute cap on the background decode width (px) at normal zoom. The whole
/// point of M1's background fix: never decode a 4000²+ source at its intrinsic
/// resolution (that was the old jank/OOM footgun). We decode at most this wide
/// and only step higher under deep zoom (see [FlatBackground]).
const int kBackgroundBaseDecodeCap = 2048;

/// Hard ceiling regardless of zoom, so a hostile 4096² image can never be
/// decoded larger than this.
const int kBackgroundMaxDecodeCap = 4096;

/// Paints a pre-decoded background [image] to fill the canvas rect. The image is
/// decoded at a *reduced* resolution ([FlatBackground]); we stretch it across
/// the full canvas-pixel rect, and the enclosing [InteractiveViewer] transform
/// scales the whole thing — so a low-res decode is fine until the user zooms in.
class FlatBackgroundPainter extends CustomPainter {
  final ui.Image? image;
  final Size canvasSize;

  /// Theme background, painted as a flat fill behind the image (covers the gap
  /// before the image decodes and any transparent edges).
  final Color fill;

  const FlatBackgroundPainter({
    required this.image,
    required this.canvasSize,
    required this.fill,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final dst = Offset.zero & canvasSize;
    canvas.drawRect(dst, Paint()..color = fill);
    final img = image;
    if (img == null) return;
    final src = Rect.fromLTWH(
      0,
      0,
      img.width.toDouble(),
      img.height.toDouble(),
    );
    canvas.drawImageRect(
      img,
      src,
      dst,
      Paint()..filterQuality = FilterQuality.medium,
    );
  }

  @override
  bool shouldRepaint(FlatBackgroundPainter old) =>
      old.image != image ||
      old.canvasSize != canvasSize ||
      old.fill != fill;
}

/// Decodes [bytes] at [targetWidth] px (constrained decode — the correct fix for
/// the unconstrained intrinsic-resolution decode). Returns `null` on a decode
/// failure (logged) so the caller can fall back to the flat theme fill.
Future<ui.Image?> decodeBackground(
  Uint8List bytes, {
  required int targetWidth,
}) async {
  try {
    final codec = await ui.instantiateImageCodec(bytes, targetWidth: targetWidth);
    final frame = await codec.getNextFrame();
    return frame.image;
  } catch (e, s) {
    logError('maps: background decode failed', s);
    return null;
  }
}

/// Chooses a decode width for a canvas of [canvasWidth] shown at [scale]
/// (canvas-px → screen-px). Base cap at normal zoom; steps up toward the source
/// width under deep zoom, never above [kBackgroundMaxDecodeCap] nor the source.
int backgroundDecodeWidth({
  required double canvasWidth,
  required double scale,
}) {
  final desired = (canvasWidth * scale).ceil(); // on-screen px actually needed
  final capped = desired.clamp(1, kBackgroundMaxDecodeCap);
  final target = capped < kBackgroundBaseDecodeCap
      ? kBackgroundBaseDecodeCap
      : capped;
  // Never ask for more than the source has.
  final bounded = target > canvasWidth.ceil() ? canvasWidth.ceil() : target;
  return bounded < 1 ? 1 : bounded;
}

/// Stateful background layer: owns the decoded [ui.Image], re-decoding at a
/// higher resolution when [scale] climbs into deep zoom (monotonic — it never
/// steps back down, so panning at high zoom doesn't thrash the decoder).
class FlatBackground extends StatefulWidget {
  const FlatBackground({
    super.key,
    required this.bytes,
    required this.canvasSize,
    required this.scale,
    required this.fill,
  });

  /// Raw (undecoded) background bytes, or `null` (renders the flat fill only).
  final Uint8List? bytes;
  final Size canvasSize;

  /// Live viewport scale (canvas-px → screen-px).
  final ValueListenable<double> scale;
  final Color fill;

  @override
  State<FlatBackground> createState() => _FlatBackgroundState();
}

class _FlatBackgroundState extends State<FlatBackground> {
  ui.Image? _image;
  int _decodedWidth = 0;
  bool _decoding = false;

  @override
  void initState() {
    super.initState();
    widget.scale.addListener(_onScale);
    _maybeDecode();
  }

  @override
  void didUpdateWidget(FlatBackground old) {
    super.didUpdateWidget(old);
    if (old.scale != widget.scale) {
      old.scale.removeListener(_onScale);
      widget.scale.addListener(_onScale);
    }
    if (old.bytes != widget.bytes) {
      _image?.dispose();
      _image = null;
      _decodedWidth = 0;
      _maybeDecode();
    }
  }

  @override
  void dispose() {
    widget.scale.removeListener(_onScale);
    _image?.dispose();
    super.dispose();
  }

  void _onScale() => _maybeDecode();

  Future<void> _maybeDecode() async {
    final bytes = widget.bytes;
    if (bytes == null || _decoding) return;
    final target = backgroundDecodeWidth(
      canvasWidth: widget.canvasSize.width,
      scale: widget.scale.value,
    );
    // Monotonic: only ever increase resolution.
    if (target <= _decodedWidth) return;
    _decoding = true;
    final img = await decodeBackground(bytes, targetWidth: target);
    _decoding = false;
    if (!mounted) {
      img?.dispose();
      return;
    }
    if (img == null) return;
    setState(() {
      _image?.dispose();
      _image = img;
      _decodedWidth = target;
    });
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: widget.canvasSize,
      isComplex: true,
      willChange: false,
      painter: FlatBackgroundPainter(
        image: _image,
        canvasSize: widget.canvasSize,
        fill: widget.fill,
      ),
    );
  }
}

/// Convenience: the flat map fill for a theme (opaque background token).
Color backgroundFillFor(MapTheme theme) => theme.background;
