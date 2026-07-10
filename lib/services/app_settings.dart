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

  // Dynamic maps (AUDIT-V2 §4). Per the owner's decision the module fetches
  // from the network BY DEFAULT — [mapsNetworkEnabled] defaults to `true` and
  // is the user's off-switch (transparency/disclosure copy names the
  // endpoints). [mapsAutoUpdate] gates the throttled ≤1/24h pointer poll.
  /// Whether the maps module may reach the network at all (pointer/manifest/
  /// asset fetches). Off => render only from the offline blob store.
  final bool mapsNetworkEnabled;

  /// Whether the app auto-checks for a newer content pointer (≤1/24h) when
  /// [mapsNetworkEnabled]. Off => updates are manual only.
  final bool mapsAutoUpdate;

  // AUDIT-V2 §6.3 — the maps "What's new" banner shows once per content version.
  /// The maps `contentVersion` whose changelog the user has already seen
  /// (dismissed the banner for), or `null` if none yet. Drives the once-per-
  /// version gate via [shouldShowMapsChangelog].
  final String? mapsLastSeenChangelogVersion;

  const AppSettingsState({
    required this.hapticsEnabled,
    required this.reduceAnimations,
    required this.fastBoot,
    required this.onboardingSeen,
    required this.lastBackupAt,
    required this.backupReminderSnoozedUntil,
    required this.autoBackupEnabled,
    required this.mapsNetworkEnabled,
    required this.mapsAutoUpdate,
    required this.mapsLastSeenChangelogVersion,
  });

  static const defaults = AppSettingsState(
    hapticsEnabled: true,
    reduceAnimations: false,
    fastBoot: false,
    onboardingSeen: false,
    lastBackupAt: null,
    backupReminderSnoozedUntil: null,
    autoBackupEnabled: false,
    mapsNetworkEnabled: true,
    mapsAutoUpdate: true,
    mapsLastSeenChangelogVersion: null,
  );

  AppSettingsState copyWith({
    bool? hapticsEnabled,
    bool? reduceAnimations,
    bool? fastBoot,
    bool? onboardingSeen,
    Object? lastBackupAt = _unset,
    Object? backupReminderSnoozedUntil = _unset,
    bool? autoBackupEnabled,
    bool? mapsNetworkEnabled,
    bool? mapsAutoUpdate,
    Object? mapsLastSeenChangelogVersion = _unset,
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
      mapsNetworkEnabled: mapsNetworkEnabled ?? this.mapsNetworkEnabled,
      mapsAutoUpdate: mapsAutoUpdate ?? this.mapsAutoUpdate,
      mapsLastSeenChangelogVersion:
          identical(mapsLastSeenChangelogVersion, _unset)
              ? this.mapsLastSeenChangelogVersion
              : mapsLastSeenChangelogVersion as String?,
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
  static const _kMapsNetwork = 'settings.mapsNetworkEnabled';
  static const _kMapsAutoUpdate = 'settings.mapsAutoUpdate';
  static const _kMapsLastSeenChangelog = 'settings.mapsLastSeenChangelogVersion';

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
      mapsNetworkEnabled: prefs.getBool(_kMapsNetwork) ??
          AppSettingsState.defaults.mapsNetworkEnabled,
      mapsAutoUpdate: prefs.getBool(_kMapsAutoUpdate) ??
          AppSettingsState.defaults.mapsAutoUpdate,
      mapsLastSeenChangelogVersion: prefs.getString(_kMapsLastSeenChangelog),
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

  /// Master off-switch for all maps network access (default on).
  Future<void> setMapsNetworkEnabled(bool value) async {
    state = state.copyWith(mapsNetworkEnabled: value);
    await _prefs.setBool(_kMapsNetwork, value);
  }

  /// Toggle the throttled auto-check for newer content (default on).
  Future<void> setMapsAutoUpdate(bool value) async {
    state = state.copyWith(mapsAutoUpdate: value);
    await _prefs.setBool(_kMapsAutoUpdate, value);
  }

  /// AUDIT-V2 §6.3: record that the user has seen the "What's new" banner for
  /// [contentVersion], so it stays dismissed until the next content version.
  Future<void> markMapsChangelogSeen(String contentVersion) async {
    if (contentVersion.isEmpty ||
        state.mapsLastSeenChangelogVersion == contentVersion) {
      return;
    }
    state = state.copyWith(mapsLastSeenChangelogVersion: contentVersion);
    await _prefs.setString(_kMapsLastSeenChangelog, contentVersion);
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
