import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../colors.dart';

class HexGridPainter extends CustomPainter {
  HexGridPainter();

  static const double _r = 18;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.accentPrimary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.4;

    final dy = _r * math.sqrt(3) / 2;
    var row = 0;
    var y = -dy;
    while (y < size.height + dy) {
      final xOffset = row.isEven ? 0.0 : _r * 1.5;
      var x = -_r + xOffset;
      while (x < size.width + _r) {
        final path = Path();
        for (var i = 0; i < 6; i++) {
          final angle = i * math.pi / 3;
          final px = x + _r * math.cos(angle);
          final py = y + _r * math.sin(angle);
          if (i == 0) {
            path.moveTo(px, py);
          } else {
            path.lineTo(px, py);
          }
        }
        path.close();
        canvas.drawPath(path, paint);
        x += _r * 3;
      }
      y += dy * 2;
      row += 1;
    }
  }

  @override
  bool shouldRepaint(covariant HexGridPainter oldDelegate) => false;
}
