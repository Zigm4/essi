import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:underdeck_app/core/logging.dart';

@immutable
class TrainStop {
  final int minute;
  final int zone;
  final String? name;
  const TrainStop({required this.minute, required this.zone, this.name});

  factory TrainStop.fromJson(Map<String, dynamic> j) => TrainStop(
    minute: (j['minute'] as num).toInt(),
    zone: (j['zone'] as num).toInt(),
    name: j['name'] as String?,
  );
}

class MarsExpressSchedule {
  final List<TrainStop> stops;
  const MarsExpressSchedule(this.stops);

  TrainStop? currentStop(int minute) {
    for (final s in stops) {
      if (s.minute == minute) return s;
    }
    return null;
  }

  String? nameFor(int zone) {
    for (final s in stops) {
      if (s.zone == zone && s.name != null) return s.name;
    }
    return null;
  }

  static Future<MarsExpressSchedule> load() async {
    try {
      final raw = await rootBundle.loadString('assets/catalog/train_schedule.json');
      final list = (jsonDecode(raw) as List<dynamic>)
          .map((e) => TrainStop.fromJson(e as Map<String, dynamic>))
          .toList();
      list.sort((a, b) => a.minute.compareTo(b.minute));
      return MarsExpressSchedule(list);
    } catch (e, st) {
      logError('Failed to load assets/catalog/train_schedule.json: $e', st);
      rethrow;
    }
  }
}

final marsExpressScheduleProvider =
    FutureProvider<MarsExpressSchedule>((ref) => MarsExpressSchedule.load());

@immutable
class ScheduleEntry {
  final int startMinute;
  final int endMinute;
  final int zone;
  final String? name;
  final bool nextHour;
  const ScheduleEntry({
    required this.startMinute,
    required this.endMinute,
    required this.zone,
    this.name,
    required this.nextHour,
  });

  String get rangeText {
    final suffix = nextHour ? '+' : '';
    final s = startMinute.toString().padLeft(2, '0');
    if (startMinute == endMinute) return ':$s$suffix';
    final e = endMinute.toString().padLeft(2, '0');
    return ':$s–$e$suffix';
  }
}

class MarsExpressService {
  MarsExpressService._();

  static List<int> nextArrivals({
    required int zone,
    required int currentMinute,
    required List<TrainStop> stops,
  }) {
    final future = <int>[];
    for (final s in stops) {
      if (s.zone == zone && s.minute > currentMinute) future.add(s.minute);
    }
    if (future.isEmpty) {
      for (final s in stops) {
        if (s.zone == zone) future.add(s.minute + 60);
      }
    }
    future.sort();
    return future;
  }

  static List<DateTime> alertDates({
    required int zone,
    required List<TrainStop> stops,
    DateTime? now,
  }) {
    final occ = nextOccurrences(zone: zone, stops: stops, count: 1, now: now);
    if (occ.isEmpty) return const [];
    return alertsForArrival(occ.first);
  }

  /// The three alert instants for a single arrival: 2 min before, 1 min
  /// before, and on arrival. Kept pure so the alert controller and tests can
  /// share it.
  static List<DateTime> alertsForArrival(DateTime arrival) => [
        arrival.subtract(const Duration(minutes: 2)),
        arrival.subtract(const Duration(minutes: 1)),
        arrival,
      ];

  /// The next [count] future arrival instants for [zone], honouring the
  /// schedule's hourly recurrence. A zone visited at multiple minutes within
  /// the hour yields multiple occurrences per hour; the sequence then wraps
  /// into subsequent hours (+1h each cycle) until [count] are collected.
  ///
  /// Only arrivals strictly after [now] are returned, so arming right on top
  /// of an arrival rolls forward to the next full cycle rather than emitting a
  /// past instant.
  static List<DateTime> nextOccurrences({
    required int zone,
    required List<TrainStop> stops,
    required int count,
    DateTime? now,
  }) {
    if (count <= 0) return const [];
    final base = now ?? DateTime.now();
    final minutes = <int>{
      for (final s in stops)
        if (s.zone == zone) s.minute,
    }.toList()
      ..sort();
    if (minutes.isEmpty) return const [];

    final result = <DateTime>[];
    var anchor = DateTime(base.year, base.month, base.day, base.hour);
    // Guard against pathological loops: at least one arrival per hour, so
    // count hours plus a small margin always suffices.
    var guard = 0;
    while (result.length < count && guard <= count + 2) {
      for (final m in minutes) {
        final dt = anchor.add(Duration(minutes: m));
        if (dt.isAfter(base)) {
          result.add(dt);
          if (result.length >= count) break;
        }
      }
      anchor = anchor.add(const Duration(hours: 1));
      guard++;
    }
    return result;
  }

  static List<ScheduleEntry> consolidated({
    required int currentMinute,
    required List<TrainStop> stops,
  }) {
    final byMinute = {for (final s in stops) s.minute: s};
    final entries = <ScheduleEntry>[];
    ScheduleEntry? current;

    void flush() {
      if (current != null) entries.add(current!);
      current = null;
    }

    for (var m = currentMinute; m < 60; m++) {
      final stop = byMinute[m];
      if (stop == null) continue;
      if (current != null && current!.zone == stop.zone && !current!.nextHour) {
        current = ScheduleEntry(
          startMinute: current!.startMinute,
          endMinute: m,
          zone: current!.zone,
          name: current!.name ?? stop.name,
          nextHour: false,
        );
      } else {
        flush();
        current = ScheduleEntry(
          startMinute: m,
          endMinute: m,
          zone: stop.zone,
          name: stop.name,
          nextHour: false,
        );
      }
    }
    flush();

    for (var m = 0; m < currentMinute; m++) {
      final stop = byMinute[m];
      if (stop == null) continue;
      if (current != null && current!.zone == stop.zone && current!.nextHour) {
        current = ScheduleEntry(
          startMinute: current!.startMinute,
          endMinute: m,
          zone: current!.zone,
          name: current!.name ?? stop.name,
          nextHour: true,
        );
      } else {
        flush();
        current = ScheduleEntry(
          startMinute: m,
          endMinute: m,
          zone: stop.zone,
          name: stop.name,
          nextHour: true,
        );
      }
    }
    flush();
    return entries;
  }
}

/// Notification-id allocation for train alerts inside the reserved band
/// [bandMin, bandMax]. Each armed zone is assigned a *slot* (a fixed sub-range
/// of the band); within a slot each scheduled occurrence gets
/// [alertsPerOccurrence] consecutive ids. Zone numbers themselves are large
/// (200+) so they can't index the band directly — slots decouple the band
/// layout from zone identity. Pure so it is unit-testable.
class TrainAlertIds {
  const TrainAlertIds._();

  static const int bandMin = 70000;
  static const int bandMax = 70999;
  static const int alertsPerOccurrence = 3;

  /// How many occurrences a repeating zone schedules ahead. With no background
  /// execution this is the "up to N hours ahead until reopened" horizon.
  static const int repeatOccurrences = 6;

  /// Ids reserved per slot: enough for [repeatOccurrences] occurrences, with a
  /// little headroom.
  static const int slotSize = 20;

  /// Number of slots that fit in the band.
  static int get slotCount => (bandMax - bandMin + 1) ~/ slotSize;

  static int slotBase(int slot) => bandMin + slot * slotSize;

  /// Every id belonging to [slot] (the whole reserved sub-range), for cancels.
  static List<int> slotIds(int slot) => [
        for (var i = 0; i < slotSize; i++) slotBase(slot) + i,
      ];

  /// The [alertsPerOccurrence] ids for occurrence [occurrenceIndex] in [slot].
  static List<int> occurrenceIds(int slot, int occurrenceIndex) => [
        for (var a = 0; a < alertsPerOccurrence; a++)
          slotBase(slot) + occurrenceIndex * alertsPerOccurrence + a,
      ];

  /// The single id for one alert (2min/1min/now) of one occurrence.
  static int alertId(int slot, int occurrenceIndex, int alertIndex) =>
      slotBase(slot) + occurrenceIndex * alertsPerOccurrence + alertIndex;

  /// Lowest slot index not present in [used], or null when the band is full.
  static int? lowestFreeSlot(Set<int> used) {
    for (var s = 0; s < slotCount; s++) {
      if (!used.contains(s)) return s;
    }
    return null;
  }
}
