import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/logging.dart';
import '../design_system/colors.dart';

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
        // F69: pin the captured subtree to no text scaling. The card is a
        // fixed-width offscreen render, so a large system font-size setting
        // would otherwise bake overflowing/clipped text into the PNG.
        child: MediaQuery(
          data: MediaQuery.of(ctx).copyWith(textScaler: TextScaler.noScaling),
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
    } catch (e, s) {
      logError(e, s);
      return null;
    } finally {
      entry.remove();
      completer.complete();
    }
  }

  /// Captures [card] to a PNG and hands it to the OS share sheet.
  ///
  /// Pass [sharePositionOrigin] — the global rect of the tapped control — so
  /// the iPad share popover has an anchor (share_plus throws on iPad without
  /// one). Use [originRectFor] to derive it from the trigger's context.
  ///
  /// Returns false when the capture fails; call sites should surface a
  /// "couldn't create the share image" message in that case.
  static Future<bool> share({
    required BuildContext context,
    required Widget card,
    required String fileName,
    String? text,
    Rect? sharePositionOrigin,
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
        sharePositionOrigin: sharePositionOrigin,
      ),
    );
    return true;
  }

  /// Global rect used to anchor the iPad share popover.
  ///
  /// Prefers the render box behind [context] (typically the tapped widget);
  /// falls back to a 1×1 rect at the screen centre when unavailable.
  static Rect originRectFor(BuildContext context) {
    final box = context.findRenderObject();
    if (box is RenderBox && box.hasSize) {
      return box.localToGlobal(Offset.zero) & box.size;
    }
    final size = MediaQuery.sizeOf(context);
    return Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: 1,
      height: 1,
    );
  }

  /// Shows the standard failure snackbar when [share] returns false. Guard the
  /// caller with a `context.mounted` check before invoking (runs post-await).
  static void showShareFailure(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Couldn\'t create the share image — try again'),
        backgroundColor: AppColors.accentDanger,
      ),
    );
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
