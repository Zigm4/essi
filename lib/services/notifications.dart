import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../core/logging.dart';
import 'app_settings.dart';

class AppNotifications {
  AppNotifications._();
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    tz_data.initializeTimeZones();
    // F57: use a white-on-transparent monochrome status-bar icon. The full
    // @mipmap/ic_launcher renders as a gray square on Android >= 5 because the
    // status bar masks the notification icon to its alpha channel.
    const android = AndroidInitializationSettings('ic_stat_underdeck');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    _initialized = true;
  }

  static Future<bool> requestPermissions() async {
    await initialize();
    final iOS = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    if (iOS != null) {
      final granted = await iOS.requestPermissions(alert: true, sound: true);
      if (granted == false) return false;
    }
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      final granted = await android.requestNotificationsPermission();
      if (granted == false) return false;
      // Android 12+ requires explicit consent to schedule exact alarms. The
      // manifest declares only SCHEDULE_EXACT_ALARM (USE_EXACT_ALARM was
      // removed for Play-policy reasons, F25), which is user-revocable — so we
      // request it here and schedule() falls back to inexact if it's denied.
      try {
        await android.requestExactAlarmsPermission();
      } catch (_) {
        // Older Android versions don't expose this method; ignore.
      }
    }
    return true;
  }

  static Future<void> schedule({
    required int id,
    required String title,
    required String body,
    required DateTime when,
  }) async {
    await initialize();
    final scheduled = tz.TZDateTime.from(when, tz.local);
    if (scheduled.isBefore(tz.TZDateTime.now(tz.local))) return;

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'mars_express',
        'Mars Express alerts',
        channelDescription: 'Train arrival reminders',
        importance: Importance.high,
        priority: Priority.high,
        // F57: white-on-transparent monochrome status-bar icon.
        icon: 'ic_stat_underdeck',
      ),
      iOS: DarwinNotificationDetails(
        interruptionLevel: InterruptionLevel.timeSensitive,
      ),
    );

    // F25: only ask for an exact alarm when the OS will actually grant one.
    // On Android 12+ SCHEDULE_EXACT_ALARM is user-revocable, so gate on
    // canScheduleExactNotifications() and fall back to inexact scheduling.
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    var mode = AndroidScheduleMode.exactAllowWhileIdle;
    if (android != null) {
      final canExact = await android.canScheduleExactNotifications();
      if (canExact == false) {
        mode = AndroidScheduleMode.inexactAllowWhileIdle;
      }
    }

    try {
      await _plugin.zonedSchedule(
        id,
        title,
        body,
        scheduled,
        details,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        androidScheduleMode: mode,
      );
    } on PlatformException catch (e, st) {
      // Some OEMs still reject exact alarms even after the gate above (revoked
      // between check and schedule, vendor policy, etc.). Retry inexact so
      // arming never throws an unhandled error.
      if (mode == AndroidScheduleMode.exactAllowWhileIdle) {
        logError(e, st);
        await _plugin.zonedSchedule(
          id,
          title,
          body,
          scheduled,
          details,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        );
      } else {
        rethrow;
      }
    }
  }

  static Future<void> cancel(int id) async {
    await initialize();
    await _plugin.cancel(id);
  }

  static Future<List<int>> pendingIDs() async {
    await initialize();
    final list = await _plugin.pendingNotificationRequests();
    return list.map((p) => p.id).toList();
  }

  static Future<void> cancelGroup({required int idMin, required int idMax}) async {
    final ids = await pendingIDs();
    for (final id in ids) {
      if (id >= idMin && id <= idMax) {
        await _plugin.cancel(id);
      }
    }
  }
}

@immutable
class TrainAlertState {
  final int? armedZone;
  final DateTime? arrival;
  const TrainAlertState({this.armedZone, this.arrival});
  static const empty = TrainAlertState();
}

class TrainAlertController extends StateNotifier<TrainAlertState> {
  TrainAlertController(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  // Persist the armed zone + arrival so the UI can restore the armed state
  // after a restart. Without this, TrainAlertState lived only in memory: the
  // OS kept firing scheduled alerts while the app UI showed "not armed".
  static const _kArmed = 'trainAlert.armed';

  static TrainAlertState _load(SharedPreferences prefs) {
    final raw = prefs.getString(_kArmed);
    if (raw == null) return TrainAlertState.empty;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final zone = map['armedZone'] as int?;
      final arrivalMs = map['arrival'] as int?;
      if (zone == null || arrivalMs == null) return TrainAlertState.empty;
      final arrival = DateTime.fromMillisecondsSinceEpoch(arrivalMs);
      // Drop stale state whose arrival is well in the past.
      if (arrival.isBefore(
          DateTime.now().subtract(const Duration(seconds: 10)))) {
        return TrainAlertState.empty;
      }
      return TrainAlertState(armedZone: zone, arrival: arrival);
    } catch (e, st) {
      logError(e, st);
      return TrainAlertState.empty;
    }
  }

  Future<void> _persist(TrainAlertState s) async {
    if (s.armedZone == null || s.arrival == null) {
      await _prefs.remove(_kArmed);
      return;
    }
    await _prefs.setString(
      _kArmed,
      jsonEncode({
        'armedZone': s.armedZone,
        'arrival': s.arrival!.millisecondsSinceEpoch,
      }),
    );
  }

  // Reserved notification-ID band for train alerts. Only one zone can be armed
  // at a time and each arming schedules exactly three alerts, so we use three
  // FIXED ids inside this band. (A previous scheme, 70000 + zone*10 + i,
  // produced ids outside the band for real zones — 234..346 — so cancelGroup
  // never matched them and alerts could never be cancelled or replaced.)
  static const _idMin = 70000;
  static const _idMax = 70999;

  Future<bool> arm({required int zone, required List<DateTime> alertDates}) async {
    final ok = await AppNotifications.requestPermissions();
    if (!ok) return false;
    await AppNotifications.cancelGroup(idMin: _idMin, idMax: _idMax);

    final labels = ['2 minutes', '1 minute', 'now'];
    final now = DateTime.now();
    var scheduled = false;
    for (var i = 0; i < alertDates.length; i++) {
      final date = alertDates[i];
      if (date.difference(now).inSeconds < 2) continue;
      // Fixed ids within [_idMin, _idMax] so cancelGroup() below (and on the
      // next arm/cancel) always matches them, regardless of the zone number.
      final id = _idMin + i;
      final body = i == 2
          ? 'Train arriving at Zone $zone now.'
          : 'Train arriving at Zone $zone in ${labels[i]}.';
      await AppNotifications.schedule(
        id: id,
        title: 'Mars Express → Zone $zone',
        body: body,
        when: date,
      );
      scheduled = true;
    }
    if (!scheduled) return false;
    state = TrainAlertState(armedZone: zone, arrival: alertDates.last);
    await _persist(state);
    return true;
  }

  Future<void> cancel() async {
    await AppNotifications.cancelGroup(idMin: _idMin, idMax: _idMax);
    state = TrainAlertState.empty;
    await _persist(state);
  }

  void refresh() {
    if (state.arrival == null) return;
    if (state.arrival!.isBefore(DateTime.now().subtract(const Duration(seconds: 10)))) {
      state = TrainAlertState.empty;
      _persist(state);
    }
  }
}

final trainAlertControllerProvider =
    StateNotifierProvider<TrainAlertController, TrainAlertState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return TrainAlertController(prefs);
});
