import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

class AppNotifications {
  AppNotifications._();
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    tz_data.initializeTimeZones();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
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
      // Android 12+ also requires explicit consent to schedule exact alarms.
      // The manifest declares USE_EXACT_ALARM (auto-granted for alarm-like
      // use cases), but request anyway for SCHEDULE_EXACT_ALARM fallbacks.
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
    await _plugin.zonedSchedule(
      id,
      title,
      body,
      scheduled,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'mars_express',
          'Mars Express alerts',
          channelDescription: 'Train arrival reminders',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          interruptionLevel: InterruptionLevel.timeSensitive,
        ),
      ),
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    );
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
  TrainAlertController() : super(TrainAlertState.empty);

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
    return true;
  }

  Future<void> cancel() async {
    await AppNotifications.cancelGroup(idMin: _idMin, idMax: _idMax);
    state = TrainAlertState.empty;
  }

  void refresh() {
    if (state.arrival == null) return;
    if (state.arrival!.isBefore(DateTime.now().subtract(const Duration(seconds: 10)))) {
      state = TrainAlertState.empty;
    }
  }
}

final trainAlertControllerProvider =
    StateNotifierProvider<TrainAlertController, TrainAlertState>((ref) {
  return TrainAlertController();
});
