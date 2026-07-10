import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/notifications.dart';
import '../domain/mars_express_models.dart';

/// A single, glanceable snapshot of "what is the next Mars Express arrival the
/// user cares about, and how long until it lands".
///
/// This is the **one source of truth** the future Live Activity / Dynamic
/// Island / home-screen widget bridge (point 20) will read. It is derived
/// purely from [MarsExpressService] schedule math plus the wall clock, so the
/// native side never has to re-implement the schedule. See
/// docs/LIVE_ACTIVITY_PLAN.md for the data contract and native wiring.
@immutable
class NextArrivalSnapshot {
  const NextArrivalSnapshot({
    required this.zone,
    required this.zoneName,
    required this.arrivalMinute,
    required this.minutesUntil,
    required this.arrival,
    required this.isArmed,
    required this.generatedAt,
  });

  /// The zone the widget tracks (see [MarsExpressNextArrival.focusedZone]).
  final int zone;

  /// Human-readable stop name for [zone], if the schedule provides one.
  final String? zoneName;

  /// Wall-clock minute (0–59) at which the train next reaches [zone].
  final int arrivalMinute;

  /// Whole minutes from `now` until [arrival], rounded up so a sub-minute
  /// countdown still reads "1 min" rather than "0 min". Always `>= 0`.
  final int minutesUntil;

  /// Absolute instant of the next arrival at [zone].
  final DateTime arrival;

  /// Whether the user has a train alert armed for [zone]. The bridge uses this
  /// to decide whether to start a Live Activity automatically.
  final bool isArmed;

  /// When this snapshot was computed. Lets the native side detect staleness.
  final DateTime generatedAt;

  /// Flat, primitive map for handing across the platform channel to the
  /// ActivityKit / Glance layer. Kept intentionally JSON-safe.
  Map<String, Object?> toBridgeMap() => {
        'zone': zone,
        'zoneName': zoneName,
        'arrivalMinute': arrivalMinute,
        'minutesUntil': minutesUntil,
        'arrivalEpochMs': arrival.millisecondsSinceEpoch,
        'isArmed': isArmed,
        'generatedAtEpochMs': generatedAt.millisecondsSinceEpoch,
      };

  @override
  bool operator ==(Object other) =>
      other is NextArrivalSnapshot &&
      other.zone == zone &&
      other.zoneName == zoneName &&
      other.arrivalMinute == arrivalMinute &&
      other.minutesUntil == minutesUntil &&
      other.arrival == arrival &&
      other.isArmed == isArmed &&
      other.generatedAt == generatedAt;

  @override
  int get hashCode => Object.hash(
        zone,
        zoneName,
        arrivalMinute,
        minutesUntil,
        arrival,
        isArmed,
        generatedAt,
      );
}

/// Pure resolution of the next-arrival snapshot. Split out from the provider so
/// it can be unit-tested without Riverpod or a real clock.
class MarsExpressNextArrival {
  const MarsExpressNextArrival._();

  /// Which zone the widget should follow.
  ///
  /// Priority: the first armed zone (the user has explicitly asked to be
  /// alerted for it) wins; otherwise fall back to the zone the train is at
  /// *right now* so an idle widget still shows something live. Returns `null`
  /// only when nothing is armed and the train is between stops.
  static int? focusedZone({
    required MarsExpressSchedule schedule,
    required List<int> armedZones,
    DateTime? now,
  }) {
    if (armedZones.isNotEmpty) return armedZones.first;
    final base = now ?? DateTime.now();
    return schedule.currentStop(base.minute)?.zone;
  }

  /// Build the snapshot for [zone], or `null` when [zone] never appears in the
  /// schedule (so there is no future arrival to count down to).
  static NextArrivalSnapshot? build({
    required int zone,
    required MarsExpressSchedule schedule,
    required Set<int> armedZones,
    DateTime? now,
  }) {
    final base = now ?? DateTime.now();
    final occ = MarsExpressService.nextOccurrences(
      zone: zone,
      stops: schedule.stops,
      count: 1,
      now: base,
    );
    if (occ.isEmpty) return null;
    final arrival = occ.first;
    // Round up: a 30-second gap should read as "1 min", never "0 min".
    final seconds = arrival.difference(base).inSeconds;
    final minutesUntil = seconds <= 0 ? 0 : (seconds + 59) ~/ 60;
    return NextArrivalSnapshot(
      zone: zone,
      zoneName: schedule.nameFor(zone),
      arrivalMinute: arrival.minute,
      minutesUntil: minutesUntil,
      arrival: arrival,
      isArmed: armedZones.contains(zone),
      generatedAt: base,
    );
  }

  /// Resolve the focused zone and build its snapshot in one step. Returns
  /// `null` when there is nothing to show.
  static NextArrivalSnapshot? resolve({
    required MarsExpressSchedule schedule,
    required List<int> armedZones,
    DateTime? now,
  }) {
    final base = now ?? DateTime.now();
    final zone = focusedZone(
      schedule: schedule,
      armedZones: armedZones,
      now: base,
    );
    if (zone == null) return null;
    return build(
      zone: zone,
      schedule: schedule,
      armedZones: armedZones.toSet(),
      now: base,
    );
  }
}

/// The current next-arrival snapshot for the Mars Express widget/Live Activity
/// bridge, or `null` when the schedule is still loading or there is nothing to
/// track.
///
/// This recomputes whenever the schedule loads or the armed-zone set changes.
/// It reads the wall clock at build time; a pull-based consumer (the native
/// bridge, or a periodic refresh) simply re-reads the provider to get a fresh
/// countdown — matching the app's existing "no background execution, top up on
/// resume" model.
final nextArrivalProvider = Provider<NextArrivalSnapshot?>((ref) {
  final schedule = ref.watch(marsExpressScheduleProvider).valueOrNull;
  if (schedule == null) return null;
  final armed = ref.watch(trainAlertControllerProvider);
  final armedZones = [for (final e in armed.zones) e.zone];
  return MarsExpressNextArrival.resolve(
    schedule: schedule,
    armedZones: armedZones,
  );
});
