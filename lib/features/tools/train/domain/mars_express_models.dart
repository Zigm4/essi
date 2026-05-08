import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
    } catch (_) {
      return const MarsExpressSchedule([]);
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
    final base = now ?? DateTime.now();
    final arrivals = nextArrivals(
      zone: zone,
      currentMinute: base.minute,
      stops: stops,
    );
    if (arrivals.isEmpty) return const [];
    final raw = arrivals.first;
    var anchor = DateTime(base.year, base.month, base.day, base.hour);
    if (raw >= 60) {
      anchor = anchor.add(const Duration(hours: 1));
      anchor = anchor.add(Duration(minutes: raw - 60));
    } else {
      anchor = anchor.add(Duration(minutes: raw));
    }
    return [
      anchor.subtract(const Duration(minutes: 2)),
      anchor.subtract(const Duration(minutes: 1)),
      anchor,
    ];
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
