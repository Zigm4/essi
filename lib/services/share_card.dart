import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Captures any Widget into a PNG via an off-screen RepaintBoundary.
///
/// Builds the [card] inside a temporary [OverlayEntry] positioned off-screen,
/// waits for two frames, then snapshots the boundary at the requested pixel
/// ratio. Suitable for "share as image" features (Scan, Tracker, etc).
class ShareCardCapture {
  ShareCardCapture._();

  static Future<Uint8List?> capture({
    required BuildContext context,
    required Widget card,
    double width = 380,
    double pixelRatio = 3.0,
  }) async {
    final overlay = Overlay.of(context);
    final repaintKey = GlobalKey();
    final completer = _CaptureCompleter();

    final entry = OverlayEntry(
      builder: (ctx) => Positioned(
        left: -10000,
        top: -10000,
        child: Material(
          color: Colors.transparent,
          child: SizedBox(
            width: width,
            child: RepaintBoundary(
              key: repaintKey,
              child: card,
            ),
          ),
        ),
      ),
    );
    overlay.insert(entry);
    try {
      // Two end-of-frame waits to ensure layout + paint completed.
      await WidgetsBinding.instance.endOfFrame;
      await WidgetsBinding.instance.endOfFrame;
      final boundary =
          repaintKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      final image = await boundary.toImage(pixelRatio: pixelRatio);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      return bytes?.buffer.asUint8List();
    } catch (_) {
      return null;
    } finally {
      entry.remove();
      completer.complete();
    }
  }

  static Future<bool> share({
    required BuildContext context,
    required Widget card,
    required String fileName,
    String? text,
  }) async {
    final bytes = await capture(context: context, card: card);
    if (bytes == null) return false;
    final dir = await getTemporaryDirectory();
    final file = File(p.join(dir.path, fileName));
    await file.writeAsBytes(bytes);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'image/png')],
        text: text ?? 'Underdeck capture',
      ),
    );
    return true;
  }
}

class _CaptureCompleter {
  bool _completed = false;
  void complete() {
    _completed = true;
  }
  // ignore: unused_element
  bool get isCompleted => _completed;
}
