import 'package:flutter/material.dart';

class ScanlinesPainter extends CustomPainter {
  ScanlinesPainter();

  static const double _step = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.18)
      ..blendMode = BlendMode.multiply;
    var y = 0.0;
    while (y < size.height) {
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, 1), paint);
      y += _step;
    }
  }

  @override
  bool shouldRepaint(covariant ScanlinesPainter oldDelegate) => false;
}
