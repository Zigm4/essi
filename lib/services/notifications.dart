import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../core/logging.dart';
import '../features/tools/train/domain/mars_express_models.dart';
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

  /// Cancel a specific set of ids (only those actually pending are touched).
  static Future<void> cancelIds(Iterable<int> ids) async {
    await initialize();
    final wanted = ids.toSet();
    if (wanted.isEmpty) return;
    final pending = (await _plugin.pendingNotificationRequests())
        .map((p) => p.id)
        .toSet();
    for (final id in wanted) {
      if (pending.contains(id)) await _plugin.cancel(id);
    }
  }
}

/// One armed zone. [slot] is its reserved id sub-range (see [TrainAlertIds]).
/// [repeat] arms the next N hourly occurrences and is topped up on refresh.
/// [lastArrival] is the last occurrence currently scheduled — used both for
/// display and to decide when a repeating slot needs topping up.
@immutable
class TrainAlertEntry {
  final int zone;
  final int slot;
  final bool repeat;
  final DateTime lastArrival;
  const TrainAlertEntry({
    required this.zone,
    required this.slot,
    required this.repeat,
    required this.lastArrival,
  });

  TrainAlertEntry copyWith({DateTime? lastArrival, bool? repeat}) =>
      TrainAlertEntry(
        zone: zone,
        slot: slot,
        repeat: repeat ?? this.repeat,
        lastArrival: lastArrival ?? this.lastArrival,
      );

  Map<String, dynamic> toJson() => {
        'zone': zone,
        'slot': slot,
        'repeat': repeat,
        'lastArrival': lastArrival.millisecondsSinceEpoch,
      };

  static TrainAlertEntry? fromJson(Map<String, dynamic> j) {
    final zone = j['zone'] as int?;
    final slot = j['slot'] as int?;
    final ms = j['lastArrival'] as int?;
    if (zone == null || slot == null || ms == null) return null;
    return TrainAlertEntry(
      zone: zone,
      slot: slot,
      repeat: j['repeat'] as bool? ?? false,
      lastArrival: DateTime.fromMillisecondsSinceEpoch(ms),
    );
  }
}

@immutable
class TrainAlertState {
  final List<TrainAlertEntry> zones;
  const TrainAlertState({this.zones = const []});
  static const empty = TrainAlertState();

  bool isArmed(int zone) => zones.any((e) => e.zone == zone);
  TrainAlertEntry? entryFor(int zone) {
    for (final e in zones) {
      if (e.zone == zone) return e;
    }
    return null;
  }
}

class TrainAlertController extends StateNotifier<TrainAlertState> {
  TrainAlertController(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  // Multi-zone armed state, persisted as a JSON list so it survives restarts.
  // (P2 stored a single {armedZone,arrival} under `_kArmedLegacy`; that shape
  // is migrated on load.)
  static const _kZones = 'trainAlert.zones';
  static const _kArmedLegacy = 'trainAlert.armed';

  static TrainAlertState _load(SharedPreferences prefs) {
    final now = DateTime.now();
    final staleBefore = now.subtract(const Duration(seconds: 10));
    // Preferred multi-zone format.
    final raw = prefs.getString(_kZones);
    if (raw != null) {
      try {
        final list = (jsonDecode(raw) as List<dynamic>)
            .map((e) => TrainAlertEntry.fromJson(e as Map<String, dynamic>))
            .whereType<TrainAlertEntry>()
            // Keep repeating entries even once their last scheduled occurrence
            // has passed — refresh() re-arms them. Drop expired one-shots.
            .where((e) => e.repeat || e.lastArrival.isAfter(staleBefore))
            .toList();
        return TrainAlertState(zones: list);
      } catch (e, st) {
        logError(e, st);
        return TrainAlertState.empty;
      }
    }
    // Legacy single-zone migration.
    final legacy = prefs.getString(_kArmedLegacy);
    if (legacy != null) {
      try {
        final map = jsonDecode(legacy) as Map<String, dynamic>;
        final zone = map['armedZone'] as int?;
        final arrivalMs = map['arrival'] as int?;
        if (zone != null && arrivalMs != null) {
          final arrival = DateTime.fromMillisecondsSinceEpoch(arrivalMs);
          if (arrival.isAfter(staleBefore)) {
            return TrainAlertState(zones: [
              TrainAlertEntry(
                zone: zone,
                slot: 0,
                repeat: false,
                lastArrival: arrival,
              ),
            ]);
          }
        }
      } catch (e, st) {
        logError(e, st);
      }
    }
    return TrainAlertState.empty;
  }

  Future<void> _persist() async {
    await _prefs.remove(_kArmedLegacy);
    if (state.zones.isEmpty) {
      await _prefs.remove(_kZones);
      return;
    }
    await _prefs.setString(
      _kZones,
      jsonEncode(state.zones.map((e) => e.toJson()).toList()),
    );
  }

  /// Schedule (or reschedule) every occurrence for one slot. Returns the last
  /// arrival actually scheduled, or null when there is nothing to schedule.
  Future<DateTime?> _scheduleSlot({
    required int zone,
    required int slot,
    required bool repeat,
    required List<TrainStop> stops,
    DateTime? now,
  }) async {
    final nowT = now ?? DateTime.now();
    final count = repeat ? TrainAlertIds.repeatOccurrences : 1;
    final occurrences = MarsExpressService.nextOccurrences(
      zone: zone,
      stops: stops,
      count: count,
      now: nowT,
    );
    if (occurrences.isEmpty) return null;

    const labels = ['2 minutes', '1 minute', 'now'];
    DateTime? lastScheduled;
    for (var o = 0; o < occurrences.length; o++) {
      final arrival = occurrences[o];
      final dates = MarsExpressService.alertsForArrival(arrival);
      var anyForOccurrence = false;
      for (var a = 0; a < dates.length; a++) {
        final date = dates[a];
        if (date.difference(nowT).inSeconds < 2) continue;
        final body = a == 2
            ? 'Train arriving at Zone $zone now.'
            : 'Train arriving at Zone $zone in ${labels[a]}.';
        await AppNotifications.schedule(
          id: TrainAlertIds.alertId(slot, o, a),
          title: 'Mars Express → Zone $zone',
          body: body,
          when: date,
        );
        anyForOccurrence = true;
      }
      if (anyForOccurrence) lastScheduled = arrival;
    }
    return lastScheduled;
  }

  /// Arm (or re-arm) [zone]. Reuses the zone's existing slot if already armed,
  /// otherwise claims the lowest free slot in the band. Returns false on denied
  /// permission, a full band, or nothing left to schedule this cycle.
  Future<bool> arm({
    required int zone,
    required List<TrainStop> stops,
    bool repeat = false,
    DateTime? now,
  }) async {
    final ok = await AppNotifications.requestPermissions();
    if (!ok) return false;

    final existing = state.entryFor(zone);
    final used = {
      for (final e in state.zones)
        if (e.zone != zone) e.slot,
    };
    final slot = existing?.slot ?? TrainAlertIds.lowestFreeSlot(used);
    if (slot == null) return false; // band full

    // Clear anything currently in this slot before rescheduling.
    await AppNotifications.cancelIds(TrainAlertIds.slotIds(slot));

    final last = await _scheduleSlot(
      zone: zone,
      slot: slot,
      repeat: repeat,
      stops: stops,
      now: now,
    );
    if (last == null) return false;

    final entry = TrainAlertEntry(
      zone: zone,
      slot: slot,
      repeat: repeat,
      lastArrival: last,
    );
    final zones = [
      for (final e in state.zones)
        if (e.zone != zone) e,
      entry,
    ];
    state = TrainAlertState(zones: zones);
    await _persist();
    return true;
  }

  /// Cancel a single zone's alerts and forget it.
  Future<void> cancelZone(int zone) async {
    final entry = state.entryFor(zone);
    if (entry == null) return;
    await AppNotifications.cancelIds(TrainAlertIds.slotIds(entry.slot));
    state = TrainAlertState(
      zones: [for (final e in state.zones) if (e.zone != zone) e],
    );
    await _persist();
  }

  /// Cancel every armed zone.
  Future<void> cancelAll() async {
    await AppNotifications.cancelGroup(
      idMin: TrainAlertIds.bandMin,
      idMax: TrainAlertIds.bandMax,
    );
    state = TrainAlertState.empty;
    await _persist();
  }

  /// Called from the periodic view ticker (and on resume). Drops expired
  /// one-shot zones and tops up repeating zones so they always have the next N
  /// hourly occurrences scheduled ahead. [stops] is required to recompute the
  /// recurrence; when unavailable, pass an empty list to only prune one-shots.
  Future<void> refresh(List<TrainStop> stops) async {
    if (state.zones.isEmpty) return;
    final now = DateTime.now();
    final staleBefore = now.subtract(const Duration(seconds: 10));
    final next = <TrainAlertEntry>[];
    var changed = false;

    for (final e in state.zones) {
      if (!e.repeat) {
        if (e.lastArrival.isAfter(staleBefore)) {
          next.add(e);
        } else {
          changed = true; // dropped an expired one-shot
        }
        continue;
      }
      // Repeating: top up only when the scheduled horizon has shifted.
      if (stops.isEmpty) {
        next.add(e);
        continue;
      }
      final occ = MarsExpressService.nextOccurrences(
        zone: e.zone,
        stops: stops,
        count: TrainAlertIds.repeatOccurrences,
        now: now,
      );
      if (occ.isEmpty) {
        next.add(e);
        continue;
      }
      if (occ.last.isAtSameMomentAs(e.lastArrival)) {
        next.add(e); // still fully scheduled, nothing to do
        continue;
      }
      await AppNotifications.cancelIds(TrainAlertIds.slotIds(e.slot));
      final last = await _scheduleSlot(
        zone: e.zone,
        slot: e.slot,
        repeat: true,
        stops: stops,
        now: now,
      );
      if (last != null) {
        next.add(e.copyWith(lastArrival: last));
        changed = true;
      } else {
        changed = true; // could not reschedule -> drop
      }
    }

    if (changed || next.length != state.zones.length) {
      state = TrainAlertState(zones: next);
      await _persist();
    }
  }
}

final trainAlertControllerProvider =
    StateNotifierProvider<TrainAlertController, TrainAlertState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return TrainAlertController(prefs);
});
