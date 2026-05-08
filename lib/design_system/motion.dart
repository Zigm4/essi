import 'package:flutter/animation.dart';

class AppMotion {
  AppMotion._();

  static const Duration cta = Duration(milliseconds: 400);
  static const Duration card = Duration(milliseconds: 550);
  static const Duration subtle = Duration(milliseconds: 200);
  static const Duration flash = Duration(milliseconds: 350);

  static const Curve ctaCurve = Curves.easeOutBack;
  static const Curve cardCurve = Curves.easeOutCubic;
  static const Curve subtleCurve = Curves.easeInOut;
  static const Curve flashCurve = Curves.easeOut;
}
