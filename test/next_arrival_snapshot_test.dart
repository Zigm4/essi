import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/train/domain/mars_express_models.dart';
import 'package:underdeck_app/features/tools/train/state/next_arrival_provider.dart';

/// Pure logic behind P3 point 20 groundwork: the single next-arrival snapshot
/// the future Live Activity / home-screen widget bridge consumes.
void main() {
  // Zone 300 is visited at :05 and :35; zone 400 (named) only at :20.
  const schedule = MarsExpressSchedule([
    TrainStop(minute: 5, zone: 300),
    TrainStop(minute: 20, zone: 400, name: 'Olympus'),
    TrainStop(minute: 35, zone: 300),
  ]);

  group('focusedZone', () {
    test('prefers the first armed zone', () {
      final z = MarsExpressNextArrival.focusedZone(
        schedule: schedule,
        armedZones: const [400, 300],
        now: DateTime(2026, 7, 10, 10, 0),
      );
      expect(z, 400);
    });

    test('falls back to the live current stop when nothing is armed', () {
      final z = MarsExpressNextArrival.focusedZone(
        schedule: schedule,
        armedZones: const [],
        now: DateTime(2026, 7, 10, 10, 20),
      );
      expect(z, 400);
    });

    test('is null when idle and nothing armed', () {
      final z = MarsExpressNextArrival.focusedZone(
        schedule: schedule,
        armedZones: const [],
        now: DateTime(2026, 7, 10, 10, 12),
      );
      expect(z, isNull);
    });
  });

  group('build', () {
    test('rounds a sub-minute gap up to 1 minute', () {
      final snap = MarsExpressNextArrival.build(
        zone: 300,
        schedule: schedule,
        armedZones: const {300},
        now: DateTime(2026, 7, 10, 10, 4, 30),
      )!;
      expect(snap.arrivalMinute, 5);
      expect(snap.minutesUntil, 1);
      expect(snap.arrival, DateTime(2026, 7, 10, 10, 5));
      expect(snap.isArmed, isTrue);
    });

    test('computes whole minutes until and carries the stop name', () {
      final snap = MarsExpressNextArrival.build(
        zone: 400,
        schedule: schedule,
        armedZones: const {},
        now: DateTime(2026, 7, 10, 10, 0),
      )!;
      expect(snap.arrivalMinute, 20);
      expect(snap.minutesUntil, 20);
      expect(snap.zoneName, 'Olympus');
      expect(snap.isArmed, isFalse);
    });

    test('wraps into the next hour past the last stop', () {
      final snap = MarsExpressNextArrival.build(
        zone: 300,
        schedule: schedule,
        armedZones: const {},
        now: DateTime(2026, 7, 10, 10, 40),
      )!;
      expect(snap.arrival, DateTime(2026, 7, 10, 11, 5));
      expect(snap.minutesUntil, 25);
    });

    test('returns null for a zone not in the schedule', () {
      final snap = MarsExpressNextArrival.build(
        zone: 999,
        schedule: schedule,
        armedZones: const {},
        now: DateTime(2026, 7, 10, 10, 0),
      );
      expect(snap, isNull);
    });
  });

  group('resolve', () {
    test('produces the armed zone snapshot end-to-end', () {
      final snap = MarsExpressNextArrival.resolve(
        schedule: schedule,
        armedZones: const [400],
        now: DateTime(2026, 7, 10, 10, 0),
      )!;
      expect(snap.zone, 400);
      expect(snap.isArmed, isTrue);
      expect(snap.minutesUntil, 20);
    });

    test('is null when idle with nothing armed', () {
      final snap = MarsExpressNextArrival.resolve(
        schedule: schedule,
        armedZones: const [],
        now: DateTime(2026, 7, 10, 10, 12),
      );
      expect(snap, isNull);
    });
  });

  test('toBridgeMap is flat and JSON-safe', () {
    final snap = MarsExpressNextArrival.build(
      zone: 400,
      schedule: schedule,
      armedZones: const {400},
      now: DateTime(2026, 7, 10, 10, 0),
    )!;
    final map = snap.toBridgeMap();
    expect(map['zone'], 400);
    expect(map['zoneName'], 'Olympus');
    expect(map['minutesUntil'], 20);
    expect(map['isArmed'], true);
    expect(map['arrivalEpochMs'], isA<int>());
    expect(map['generatedAtEpochMs'], isA<int>());
  });
}
