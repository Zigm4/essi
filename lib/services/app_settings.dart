import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sentinel so nullable fields in [AppSettingsState.copyWith] can be set back to
/// `null` explicitly (a plain `DateTime?` default can't distinguish "leave as
/// is" from "clear it").
const Object _unset = Object();

@immutable
class AppSettingsState {
  final bool hapticsEnabled;
  final bool reduceAnimations;
  final bool fastBoot;
  final bool onboardingSeen;

  // P3/25 — backup reminder + optional auto-export.
  /// When the user last exported/backed up their data (any path), or `null` if
  /// they never have.
  final DateTime? lastBackupAt;

  /// While `now` is before this, the backup reminder banner stays hidden
  /// (the user dismissed/snoozed it). `null` = not snoozed.
  final DateTime? backupReminderSnoozedUntil;

  /// Opt-in: after enough changes, silently write a timestamped export JSON
  /// into the app's Documents directory (visible via Files/file manager).
  final bool autoBackupEnabled;

  const AppSettingsState({
    required this.hapticsEnabled,
    required this.reduceAnimations,
    required this.fastBoot,
    required this.onboardingSeen,
    required this.lastBackupAt,
    required this.backupReminderSnoozedUntil,
    required this.autoBackupEnabled,
  });

  static const defaults = AppSettingsState(
    hapticsEnabled: true,
    reduceAnimations: false,
    fastBoot: false,
    onboardingSeen: false,
    lastBackupAt: null,
    backupReminderSnoozedUntil: null,
    autoBackupEnabled: false,
  );

  AppSettingsState copyWith({
    bool? hapticsEnabled,
    bool? reduceAnimations,
    bool? fastBoot,
    bool? onboardingSeen,
    Object? lastBackupAt = _unset,
    Object? backupReminderSnoozedUntil = _unset,
    bool? autoBackupEnabled,
  }) {
    return AppSettingsState(
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
      reduceAnimations: reduceAnimations ?? this.reduceAnimations,
      fastBoot: fastBoot ?? this.fastBoot,
      onboardingSeen: onboardingSeen ?? this.onboardingSeen,
      lastBackupAt: identical(lastBackupAt, _unset)
          ? this.lastBackupAt
          : lastBackupAt as DateTime?,
      backupReminderSnoozedUntil: identical(backupReminderSnoozedUntil, _unset)
          ? this.backupReminderSnoozedUntil
          : backupReminderSnoozedUntil as DateTime?,
      autoBackupEnabled: autoBackupEnabled ?? this.autoBackupEnabled,
    );
  }
}

class AppSettingsNotifier extends StateNotifier<AppSettingsState> {
  static const _kHaptics = 'settings.hapticsEnabled';
  static const _kMotion = 'settings.reduceAnimations';
  static const _kFastBoot = 'settings.fastBoot';
  static const _kOnboardingSeen = 'settings.onboardingSeen';
  static const _kLastBackupAt = 'settings.lastBackupAt';
  static const _kBackupSnoozedUntil = 'settings.backupReminderSnoozedUntil';
  static const _kAutoBackup = 'settings.autoBackupEnabled';

  AppSettingsNotifier(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  static DateTime? _readDate(SharedPreferences prefs, String key) {
    final ms = prefs.getInt(key);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  static AppSettingsState _load(SharedPreferences prefs) {
    return AppSettingsState(
      hapticsEnabled: prefs.getBool(_kHaptics) ?? AppSettingsState.defaults.hapticsEnabled,
      reduceAnimations: prefs.getBool(_kMotion) ?? AppSettingsState.defaults.reduceAnimations,
      fastBoot: prefs.getBool(_kFastBoot) ?? AppSettingsState.defaults.fastBoot,
      onboardingSeen:
          prefs.getBool(_kOnboardingSeen) ?? AppSettingsState.defaults.onboardingSeen,
      lastBackupAt: _readDate(prefs, _kLastBackupAt),
      backupReminderSnoozedUntil: _readDate(prefs, _kBackupSnoozedUntil),
      autoBackupEnabled:
          prefs.getBool(_kAutoBackup) ?? AppSettingsState.defaults.autoBackupEnabled,
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

  Future<void> setOnboardingSeen(bool value) async {
    state = state.copyWith(onboardingSeen: value);
    await _prefs.setBool(_kOnboardingSeen, value);
  }

  /// P3/25: record a successful export/backup. Clears any active snooze so the
  /// reminder's timer restarts cleanly from the new backup point.
  Future<void> markBackedUp([DateTime? at]) async {
    final when = at ?? DateTime.now();
    state = state.copyWith(
      lastBackupAt: when,
      backupReminderSnoozedUntil: null,
    );
    await _prefs.setInt(_kLastBackupAt, when.millisecondsSinceEpoch);
    await _prefs.remove(_kBackupSnoozedUntil);
  }

  /// P3/25: dismiss the reminder banner until [until].
  Future<void> snoozeBackupReminder(DateTime until) async {
    state = state.copyWith(backupReminderSnoozedUntil: until);
    await _prefs.setInt(_kBackupSnoozedUntil, until.millisecondsSinceEpoch);
  }

  Future<void> setAutoBackupEnabled(bool value) async {
    state = state.copyWith(autoBackupEnabled: value);
    await _prefs.setBool(_kAutoBackup, value);
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
