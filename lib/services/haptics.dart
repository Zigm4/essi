import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_settings.dart';

class Haptics {
  Haptics._(this._enabled);
  final bool _enabled;

  static Haptics of(WidgetRef ref) {
    final enabled = ref.read(appSettingsProvider).hapticsEnabled;
    return Haptics._(enabled);
  }

  void tap() {
    if (!_enabled) return;
    HapticFeedback.lightImpact();
  }

  void selection() {
    if (!_enabled) return;
    HapticFeedback.selectionClick();
  }

  void success() {
    if (!_enabled) return;
    HapticFeedback.mediumImpact();
  }

  void warning() {
    if (!_enabled) return;
    HapticFeedback.mediumImpact();
  }

  void error() {
    if (!_enabled) return;
    HapticFeedback.heavyImpact();
  }
}
