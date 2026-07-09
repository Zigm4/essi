import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

@immutable
class AppSettingsState {
  final bool hapticsEnabled;
  final bool reduceAnimations;
  final bool fastBoot;

  const AppSettingsState({
    required this.hapticsEnabled,
    required this.reduceAnimations,
    required this.fastBoot,
  });

  static const defaults = AppSettingsState(
    hapticsEnabled: true,
    reduceAnimations: false,
    fastBoot: false,
  );

  AppSettingsState copyWith({
    bool? hapticsEnabled,
    bool? reduceAnimations,
    bool? fastBoot,
  }) {
    return AppSettingsState(
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
      reduceAnimations: reduceAnimations ?? this.reduceAnimations,
      fastBoot: fastBoot ?? this.fastBoot,
    );
  }
}

class AppSettingsNotifier extends StateNotifier<AppSettingsState> {
  static const _kHaptics = 'settings.hapticsEnabled';
  static const _kMotion = 'settings.reduceAnimations';
  static const _kFastBoot = 'settings.fastBoot';

  AppSettingsNotifier(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  static AppSettingsState _load(SharedPreferences prefs) {
    return AppSettingsState(
      hapticsEnabled: prefs.getBool(_kHaptics) ?? AppSettingsState.defaults.hapticsEnabled,
      reduceAnimations: prefs.getBool(_kMotion) ?? AppSettingsState.defaults.reduceAnimations,
      fastBoot: prefs.getBool(_kFastBoot) ?? AppSettingsState.defaults.fastBoot,
    );
  }

  Future<void> setHapticsEnabled(bool value) async {
    state = state.copyWith(hapticsEnabled: value);
    await _prefs.setBool(_kHaptics, value);
  }

  Future<void> setReduceAnimations(bool value) async {
    state = state.copyWith(reduceAnimations: value);
    await _prefs.setBool(_kMotion, value);
  }

  Future<void> setFastBoot(bool value) async {
    state = state.copyWith(fastBoot: value);
    await _prefs.setBool(_kFastBoot, value);
  }
}

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferences must be overridden in main()');
});

final appSettingsProvider =
    StateNotifierProvider<AppSettingsNotifier, AppSettingsState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return AppSettingsNotifier(prefs);
});
