import 'dart:async';
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

  /// P3 — whether the OS will schedule *exact* alarms right now. On Android 12+
  /// SCHEDULE_EXACT_ALARM is user-revocable; when it's off, [schedule] silently
  /// falls back to inexact timing, so the UI surfaces an "approximate timing"
  /// hint. iOS always delivers at the requested instant, so it reports true.
  static Future<bool> canScheduleExactAlarms() async {
    await initialize();
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return true; // iOS / non-Android
    try {
      return await android.canScheduleExactNotifications() ?? true;
    } catch (_) {
      // Older Android versions don't expose the check; they schedule exactly.
      return true;
    }
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

/// Outcome of an [TrainAlertController.arm] call. Lets the UI show a reason
/// that matches reality instead of always blaming permissions (E4).
enum ArmOutcome {
  /// Every planned alert was scheduled.
  armed,

  /// Armed, but the global notification budget (P2/E6) dropped the farthest
  /// occurrences — still useful, worth a heads-up.
  armedTruncated,

  /// The user hasn't granted notification permission.
  permissionDenied,

  /// All alert slots in the reserved band are already taken.
  bandFull,

  /// The global pending-notification budget is already exhausted by other
  /// armed zones; nothing could be scheduled for this one.
  budgetFull,

  /// Nothing was schedulable this cycle (every alert instant is <2s away or in
  /// the past). Not an error state to hide behind a permission message.
  nothingToSchedule,
}

class TrainAlertController extends StateNotifier<TrainAlertState> {
  TrainAlertController(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  // Multi-zone armed state, persisted as a JSON list so it survives restarts.
  // (P2 stored a single {armedZone,arrival} under `_kArmedLegacy`; that shape
  // is migrated on load.)
  static const _kZones = 'trainAlert.zones';
  static const _kArmedLegacy = 'trainAlert.armed';
  static const _kLegacyCleanup = 'trainAlert.didLegacyCleanup';

  // E2 — serialize every state-mutating operation (arm / cancelZone /
  // cancelAll / refresh) onto a single chained future so their many awaits can
  // never interleave. Without this, refresh()'s ~20 awaits let a concurrent
  // cancel be lost, or resurrected a zone the user just cancelled.
  Future<void> _queue = Future<void>.value();

  Future<T> _serialize<T>(Future<T> Function() op) {
    final done = Completer<T>();
    _queue = _queue.then((_) async {
      try {
        done.complete(await op());
      } catch (e, st) {
        done.completeError(e, st);
      }
    });
    return done.future;
  }

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
  /// When [allowed] is non-null (P2/E6 budget), only alert instants in that set
  /// are scheduled — the rest are dropped as farthest-first budget casualties.
  Future<DateTime?> _scheduleSlot({
    required int zone,
    required int slot,
    required bool repeat,
    required List<TrainStop> stops,
    DateTime? now,
    Set<DateTime>? allowed,
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
    // Dedup by instant so two arrivals that alert at the same DateTime schedule
    // one notification, keeping the actual pending count equal to the budgeted
    // (deduped) count from plannedAlertInstants.
    final scheduledDates = <DateTime>{};
    for (var o = 0; o < occurrences.length; o++) {
      final arrival = occurrences[o];
      final dates = MarsExpressService.alertsForArrival(arrival);
      var anyForOccurrence = false;
      for (var a = 0; a < dates.length; a++) {
        final date = dates[a];
        if (date.difference(nowT).inSeconds < 2) continue;
        if (allowed != null && !allowed.contains(date)) continue; // P2 budget
        if (!scheduledDates.add(date)) continue; // already scheduled this pass
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

  /// P2/E6 — the alert instants a slot would schedule for [zone], filtered to
  /// those still far enough in the future to fire (matches the <2s skip in
  /// [_scheduleSlot]). Pure so the budget arithmetic is unit-testable.
  static List<DateTime> plannedAlertInstants({
    required int zone,
    required List<TrainStop> stops,
    required bool repeat,
    required DateTime now,
  }) {
    final count = repeat ? TrainAlertIds.repeatOccurrences : 1;
    final occ = MarsExpressService.nextOccurrences(
      zone: zone,
      stops: stops,
      count: count,
      now: now,
    );
    // Dedup by instant: two arrivals <3 min apart can emit an alert at the
    // same DateTime; each is one notification but we only ever schedule one per
    // instant (see _scheduleSlot), so the budget must count unique instants.
    final seen = <DateTime>{};
    final out = <DateTime>[];
    for (final arrival in occ) {
      for (final d in MarsExpressService.alertsForArrival(arrival)) {
        if (d.difference(now).inSeconds >= 2 && seen.add(d)) out.add(d);
      }
    }
    return out;
  }

  /// P2/E6 — fit a zone's [candidate] alert instants into what's left of the
  /// global [budget] after [othersPending] are already scheduled. iOS keeps
  /// only the nearest pending, so we keep the nearest-in-time instants and drop
  /// the farthest, preserving schedule order in [keep]. Pure.
  static ({List<DateTime> keep, bool truncated, bool full}) planWithinBudget({
    required List<DateTime> candidate,
    required int othersPending,
    int budget = TrainAlertIds.pendingBudget,
  }) {
    final remaining = budget - othersPending;
    if (remaining <= 0) {
      return (keep: const <DateTime>[], truncated: candidate.isNotEmpty, full: true);
    }
    if (candidate.length <= remaining) {
      return (keep: candidate, truncated: false, full: false);
    }
    final nearest = ([...candidate]..sort()).take(remaining).toSet();
    return (
      keep: [for (final d in candidate) if (nearest.contains(d)) d],
      truncated: true,
      full: false,
    );
  }

  /// E2 — merge a refresh pass's per-zone [results] onto the CURRENT armed
  /// state at commit time, instead of overwriting the stale snapshot the pass
  /// started from. Each result carries the zone's snapshot slot and either the
  /// refreshed entry or null (drop). A zone the user cancelled (absent from
  /// [current]) or re-armed to a different slot mid-pass keeps the current
  /// state — so a concurrent cancel wins and a cancelled zone is never
  /// resurrected. Zones added concurrently (absent from [results]) are kept as
  /// they are. Pure.
  static List<TrainAlertEntry> mergeRefresh({
    required List<TrainAlertEntry> current,
    required Map<int, ({int slot, TrainAlertEntry? updated})> results,
  }) {
    final out = <TrainAlertEntry>[];
    for (final e in current) {
      final r = results[e.zone];
      if (r == null || r.slot != e.slot) {
        out.add(e); // not in this pass, or re-armed since -> keep current
        continue;
      }
      if (r.updated != null) out.add(r.updated!); // apply top-up
      // else: refresh dropped it AND it's unchanged since snapshot -> drop
    }
    return out;
  }

  /// P2/E6 — how much of the global budget the OTHER zones actually consume,
  /// read from the OS's real pending notifications in the reserved band minus
  /// [excludeSlot]'s ids. Counting actual pending (not a recomputed, untruncated
  /// model) means prior truncation is reflected, so we never falsely report the
  /// budget full and coverage doesn't silently shrink on a later refresh.
  Future<int> _othersPending({required int excludeSlot}) async {
    final pending = await AppNotifications.pendingIDs();
    final lo = TrainAlertIds.slotBase(excludeSlot);
    final hi = lo + TrainAlertIds.slotSize;
    return pending
        .where((id) =>
            id >= TrainAlertIds.bandMin &&
            id <= TrainAlertIds.bandMax &&
            !(id >= lo && id < hi))
        .length;
  }

  /// Arm (or re-arm) [zone]. Reuses the zone's existing slot if already armed,
  /// otherwise claims the lowest free slot in the band. Serialized against the
  /// other mutators (E2). See [ArmOutcome] for the differentiated results (E4).
  Future<ArmOutcome> arm({
    required int zone,
    required List<TrainStop> stops,
    bool repeat = false,
    DateTime? now,
  }) =>
      _serialize(
        () => _armLocked(zone: zone, stops: stops, repeat: repeat, now: now),
      );

  Future<ArmOutcome> _armLocked({
    required int zone,
    required List<TrainStop> stops,
    bool repeat = false,
    DateTime? now,
  }) async {
    final ok = await AppNotifications.requestPermissions();
    if (!ok) return ArmOutcome.permissionDenied;
    if (!mounted) return ArmOutcome.nothingToSchedule;

    final nowT = now ?? DateTime.now();
    final existing = state.entryFor(zone);
    final used = {
      for (final e in state.zones)
        if (e.zone != zone) e.slot,
    };
    final slot = existing?.slot ?? TrainAlertIds.lowestFreeSlot(used);
    if (slot == null) return ArmOutcome.bandFull;

    // P2/E6 — budget this zone against everything else already armed. Query
    // BEFORE cancelling this slot; excludeSlot keeps this zone's own (soon-to-be
    // replaced) pending ids out of the count.
    final othersPending = await _othersPending(excludeSlot: slot);
    final candidate = plannedAlertInstants(
      zone: zone,
      stops: stops,
      repeat: repeat,
      now: nowT,
    );
    final plan =
        planWithinBudget(candidate: candidate, othersPending: othersPending);
    if (plan.full) return ArmOutcome.budgetFull;

    // Clear anything currently in this slot before rescheduling.
    await AppNotifications.cancelIds(TrainAlertIds.slotIds(slot));

    final last = await _scheduleSlot(
      zone: zone,
      slot: slot,
      repeat: repeat,
      stops: stops,
      now: nowT,
      allowed: plan.keep.toSet(),
    );
    if (last == null) {
      // E4 — nothing was schedulable this cycle (all instants <2s away / past).
      // Don't leave a phantom "armed" entry whose ids we just cancelled: drop
      // the stale entry (if any) and persist the honest state.
      if (existing != null && mounted) {
        state = TrainAlertState(
          zones: [for (final e in state.zones) if (e.zone != zone) e],
        );
        await _persist();
      }
      return ArmOutcome.nothingToSchedule;
    }

    if (!mounted) return ArmOutcome.nothingToSchedule;
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
    return plan.truncated ? ArmOutcome.armedTruncated : ArmOutcome.armed;
  }

  /// Cancel a single zone's alerts and forget it. Serialized (E2).
  Future<void> cancelZone(int zone) => _serialize(() => _cancelZoneLocked(zone));

  Future<void> _cancelZoneLocked(int zone) async {
    final entry = state.entryFor(zone);
    if (entry == null) return;
    await AppNotifications.cancelIds(TrainAlertIds.slotIds(entry.slot));
    if (!mounted) return;
    state = TrainAlertState(
      zones: [for (final e in state.zones) if (e.zone != zone) e],
    );
    await _persist();
  }

  /// Cancel every armed zone. Serialized (E2).
  Future<void> cancelAll() => _serialize(_cancelAllLocked);

  Future<void> _cancelAllLocked() async {
    await AppNotifications.cancelGroup(
      idMin: TrainAlertIds.bandMin,
      idMax: TrainAlertIds.bandMax,
    );
    if (!mounted) return;
    state = TrainAlertState.empty;
    await _persist();
  }

  /// E9 — one-shot sweep of ids the pre-P2 scheme scheduled *outside* the
  /// reserved band (`70000 + zone*10 + i`), which the band-scoped cancels can
  /// never reach. Runs at most once per install (prefs flag); safe to call on
  /// every launch and serialized with the other mutators.
  Future<void> cleanupLegacyIdsOnce() {
    if (_prefs.getBool(_kLegacyCleanup) ?? false) return Future<void>.value();
    return _serialize(_legacyCleanupLocked);
  }

  Future<void> _legacyCleanupLocked() async {
    if (_prefs.getBool(_kLegacyCleanup) ?? false) return;
    try {
      await AppNotifications.cancelIds(TrainAlertIds.legacyPrePlanIds());
    } catch (e, st) {
      // Only mark the sweep done on success, so a failed cleanup is retried on
      // the next launch instead of leaving legacy ids un-cancellable forever.
      logError(e, st);
      return;
    }
    await _prefs.setBool(_kLegacyCleanup, true);
  }

  /// Called from the periodic view ticker (and on resume). Drops expired
  /// one-shot zones and tops up repeating zones so they always have the next N
  /// hourly occurrences scheduled ahead. [stops] is required to recompute the
  /// recurrence; when unavailable, pass an empty list to only prune one-shots.
  /// Serialized against arm/cancel and committed by merging onto the CURRENT
  /// state, so a cancel that lands during the pass wins (E2).
  Future<void> refresh(List<TrainStop> stops) =>
      // Called fire-and-forget from the 5s ticker / on resume. _refreshLocked
      // can throw (schedule() may rethrow a PlatformException even in inexact
      // mode), so swallow+log here — the returned future must never surface an
      // unobserved async error.
      _serialize(() => _refreshLocked(stops)).catchError((Object e, StackTrace st) {
        logError(e, st);
      });

  Future<void> _refreshLocked(List<TrainStop> stops) async {
    final snapshot = state.zones;
    if (snapshot.isEmpty) return;
    final now = DateTime.now();
    final staleBefore = now.subtract(const Duration(seconds: 10));

    // Per-zone outcome keyed by zone: (snapshot slot, refreshed entry or null
    // to drop). Committed via [mergeRefresh] onto the state as it is *now*.
    final results = <int, ({int slot, TrainAlertEntry? updated})>{};

    for (final e in snapshot) {
      if (!e.repeat) {
        results[e.zone] = (
          slot: e.slot,
          updated: e.lastArrival.isAfter(staleBefore) ? e : null,
        );
        continue;
      }
      // Repeating: top up only when the scheduled horizon has shifted.
      if (stops.isEmpty) {
        results[e.zone] = (slot: e.slot, updated: e);
        continue;
      }
      final occ = MarsExpressService.nextOccurrences(
        zone: e.zone,
        stops: stops,
        count: TrainAlertIds.repeatOccurrences,
        now: now,
      );
      if (occ.isEmpty || occ.last.isAtSameMomentAs(e.lastArrival)) {
        results[e.zone] = (slot: e.slot, updated: e); // nothing to do
        continue;
      }
      // Horizon shifted: reschedule this slot under the global budget (P2/E6).
      final othersPending = await _othersPending(excludeSlot: e.slot);
      final candidate = plannedAlertInstants(
        zone: e.zone,
        stops: stops,
        repeat: true,
        now: now,
      );
      final plan =
          planWithinBudget(candidate: candidate, othersPending: othersPending);
      await AppNotifications.cancelIds(TrainAlertIds.slotIds(e.slot));
      final last = plan.full
          ? null
          : await _scheduleSlot(
              zone: e.zone,
              slot: e.slot,
              repeat: true,
              stops: stops,
              now: now,
              allowed: plan.keep.toSet(),
            );
      results[e.zone] = (
        slot: e.slot,
        updated: last == null ? null : e.copyWith(lastArrival: last),
      );
    }

    if (!mounted) return;
    final merged = mergeRefresh(current: state.zones, results: results);

    // Commit only when the merged result differs from the current state.
    var unchanged = merged.length == state.zones.length;
    if (unchanged) {
      final cur = {for (final e in state.zones) e.zone: e};
      for (final e in merged) {
        final c = cur[e.zone];
        if (c == null ||
            c.slot != e.slot ||
            c.repeat != e.repeat ||
            !c.lastArrival.isAtSameMomentAs(e.lastArrival)) {
          unchanged = false;
          break;
        }
      }
    }
    if (!unchanged) {
      state = TrainAlertState(zones: merged);
      await _persist();
    }
  }
}

final trainAlertControllerProvider =
    StateNotifierProvider<TrainAlertController, TrainAlertState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return TrainAlertController(prefs);
});

/// P3 — whether the OS will schedule exact alarms right now. The UI reads this
/// to show an "approximate timing" hint on armed zones when exact alarms are
/// unavailable (Android 12+ with SCHEDULE_EXACT_ALARM revoked). Never blocks
/// arming.
final exactAlarmCapabilityProvider =
    FutureProvider<bool>((ref) => AppNotifications.canScheduleExactAlarms());
