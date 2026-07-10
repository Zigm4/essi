import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/train/domain/mars_express_models.dart';
import 'package:underdeck_app/services/notifications.dart';

/// Pure logic behind P3 point 21: notification-id allocation inside the
/// reserved band, and the "next N hourly occurrences" recurrence used to
/// schedule (and top up) repeating train alerts.
void main() {
  group('TrainAlertIds', () {
    test('slot bases stay inside the reserved band', () {
      expect(TrainAlertIds.slotBase(0), TrainAlertIds.bandMin);
      for (var s = 0; s < TrainAlertIds.slotCount; s++) {
        for (final id in TrainAlertIds.slotIds(s)) {
          expect(id, inInclusiveRange(TrainAlertIds.bandMin, TrainAlertIds.bandMax));
        }
      }
    });

    test('occurrence ids are three consecutive ids per occurrence', () {
      final base = TrainAlertIds.slotBase(2);
      expect(TrainAlertIds.occurrenceIds(2, 0), [base, base + 1, base + 2]);
      expect(TrainAlertIds.occurrenceIds(2, 1), [base + 3, base + 4, base + 5]);
      expect(TrainAlertIds.alertId(2, 1, 2), base + 5);
    });

    test('all ids of a repeating slot fit within its slot size', () {
      // 6 occurrences * 3 alerts = 18 ids, must fit in slotSize (20).
      final maxOffset = (TrainAlertIds.repeatOccurrences - 1) *
              TrainAlertIds.alertsPerOccurrence +
          (TrainAlertIds.alertsPerOccurrence - 1);
      expect(maxOffset, lessThan(TrainAlertIds.slotSize));
    });

    test('slots of different zones never collide', () {
      final s0 = TrainAlertIds.slotIds(0).toSet();
      final s1 = TrainAlertIds.slotIds(1).toSet();
      expect(s0.intersection(s1), isEmpty);
    });

    test('lowestFreeSlot skips used slots and reports a full band', () {
      expect(TrainAlertIds.lowestFreeSlot({}), 0);
      expect(TrainAlertIds.lowestFreeSlot({0, 1, 3}), 2);
      final all = {for (var s = 0; s < TrainAlertIds.slotCount; s++) s};
      expect(TrainAlertIds.lowestFreeSlot(all), isNull);
    });
  });

  group('MarsExpressService.nextOccurrences', () {
    // Zone 100 is visited twice an hour (:05 and :35); zone 200 once (:10).
    const stops = [
      TrainStop(minute: 5, zone: 100),
      TrainStop(minute: 10, zone: 200),
      TrainStop(minute: 35, zone: 100),
    ];

    test('returns the next single arrival strictly after now', () {
      final now = DateTime(2026, 7, 9, 8, 20); // between :05 and :35
      final occ = MarsExpressService.nextOccurrences(
        zone: 100,
        stops: stops,
        count: 1,
        now: now,
      );
      expect(occ, [DateTime(2026, 7, 9, 8, 35)]);
    });

    test('arming right on an arrival rolls forward to the next cycle', () {
      final now = DateTime(2026, 7, 9, 8, 5, 0); // exactly at :05 arrival
      final occ = MarsExpressService.nextOccurrences(
        zone: 100,
        stops: stops,
        count: 1,
        now: now,
      );
      // :05 is not strictly after now, so the next is :35.
      expect(occ.first, DateTime(2026, 7, 9, 8, 35));
    });

    test('collects N occurrences across intra-hour stops and hour wraps', () {
      final now = DateTime(2026, 7, 9, 8, 0);
      final occ = MarsExpressService.nextOccurrences(
        zone: 100,
        stops: stops,
        count: 6,
        now: now,
      );
      expect(occ, [
        DateTime(2026, 7, 9, 8, 5),
        DateTime(2026, 7, 9, 8, 35),
        DateTime(2026, 7, 9, 9, 5),
        DateTime(2026, 7, 9, 9, 35),
        DateTime(2026, 7, 9, 10, 5),
        DateTime(2026, 7, 9, 10, 35),
      ]);
      // Strictly increasing.
      for (var i = 1; i < occ.length; i++) {
        expect(occ[i].isAfter(occ[i - 1]), isTrue);
      }
    });

    test('single-stop zone recurs hourly', () {
      final now = DateTime(2026, 7, 9, 8, 20);
      final occ = MarsExpressService.nextOccurrences(
        zone: 200,
        stops: stops,
        count: 3,
        now: now,
      );
      expect(occ, [
        DateTime(2026, 7, 9, 9, 10),
        DateTime(2026, 7, 9, 10, 10),
        DateTime(2026, 7, 9, 11, 10),
      ]);
    });

    test('unknown zone or non-positive count yields nothing', () {
      final now = DateTime(2026, 7, 9, 8, 0);
      expect(
        MarsExpressService.nextOccurrences(
            zone: 999, stops: stops, count: 6, now: now),
        isEmpty,
      );
      expect(
        MarsExpressService.nextOccurrences(
            zone: 100, stops: stops, count: 0, now: now),
        isEmpty,
      );
    });

    test('alertsForArrival gives -2min, -1min, and the arrival', () {
      final arrival = DateTime(2026, 7, 9, 8, 35);
      expect(MarsExpressService.alertsForArrival(arrival), [
        DateTime(2026, 7, 9, 8, 33),
        DateTime(2026, 7, 9, 8, 34),
        arrival,
      ]);
    });
  });

  // Zone 100 is visited twice an hour (:05 and :35); zone 200 once (:10).
  const stops = [
    TrainStop(minute: 5, zone: 100),
    TrainStop(minute: 10, zone: 200),
    TrainStop(minute: 35, zone: 100),
  ];

  group('TrainAlertController.plannedAlertInstants (P2/E6)', () {
    test('three future instants for a one-shot arrival', () {
      final now = DateTime(2026, 7, 9, 8, 20); // next :35 arrival
      final instants = TrainAlertController.plannedAlertInstants(
        zone: 100,
        stops: stops,
        repeat: false,
        now: now,
      );
      expect(instants, [
        DateTime(2026, 7, 9, 8, 33),
        DateTime(2026, 7, 9, 8, 34),
        DateTime(2026, 7, 9, 8, 35),
      ]);
    });

    test('drops instants within 2s of now (unschedulable)', () {
      // now is 1s before the :31 arrival: only its -2/-1 min are in the past
      // and the arrival itself is <2s away, so nothing is schedulable.
      final now = DateTime(2026, 7, 9, 8, 30, 59);
      final instants = TrainAlertController.plannedAlertInstants(
        zone: 300,
        stops: const [TrainStop(minute: 31, zone: 300)],
        repeat: false,
        now: now,
      );
      expect(instants, isEmpty);
    });

    test('a repeating zone plans 3 instants per occurrence', () {
      final now = DateTime(2026, 7, 9, 8, 0);
      final instants = TrainAlertController.plannedAlertInstants(
        zone: 100,
        stops: stops,
        repeat: true,
        now: now,
      );
      // 6 occurrences * 3 alerts.
      expect(instants, hasLength(TrainAlertIds.repeatOccurrences * 3));
    });
  });

  group('TrainAlertController.planWithinBudget (P2/E6)', () {
    List<DateTime> instants(int n) => [
          for (var i = 0; i < n; i++) DateTime(2026, 7, 9, 8, 0).add(Duration(minutes: i)),
        ];

    test('fits fully when under budget', () {
      final plan = TrainAlertController.planWithinBudget(
        candidate: instants(10),
        othersPending: 0,
        budget: 60,
      );
      expect(plan.keep, hasLength(10));
      expect(plan.truncated, isFalse);
      expect(plan.full, isFalse);
    });

    test('truncates the farthest, keeping the nearest in schedule order', () {
      final cand = instants(10); // 08:00..08:09, ascending
      final plan = TrainAlertController.planWithinBudget(
        candidate: cand,
        othersPending: 56, // remaining = 4
        budget: 60,
      );
      expect(plan.truncated, isTrue);
      expect(plan.full, isFalse);
      // Keeps the 4 nearest (08:00..08:03), preserving order.
      expect(plan.keep, cand.take(4).toList());
    });

    test('nearest-first even when candidate is unsorted', () {
      final a = DateTime(2026, 7, 9, 8, 0);
      final b = DateTime(2026, 7, 9, 8, 5);
      final c = DateTime(2026, 7, 9, 8, 10);
      final plan = TrainAlertController.planWithinBudget(
        candidate: [c, a, b], // out of order
        othersPending: 59, // remaining = 1
        budget: 60,
      );
      expect(plan.keep, [a]); // nearest kept, original-order preserved
      expect(plan.truncated, isTrue);
    });

    test('reports full when other zones already consume the budget', () {
      final plan = TrainAlertController.planWithinBudget(
        candidate: instants(3),
        othersPending: 60,
        budget: 60,
      );
      expect(plan.full, isTrue);
      expect(plan.keep, isEmpty);
      expect(plan.truncated, isTrue);
    });
  });

  group('TrainAlertController.mergeRefresh (E2 race)', () {
    TrainAlertEntry entry(int zone, int slot, DateTime last, {bool repeat = false}) =>
        TrainAlertEntry(zone: zone, slot: slot, repeat: repeat, lastArrival: last);
    final t0 = DateTime(2026, 7, 9, 8, 0);
    final t1 = DateTime(2026, 7, 9, 9, 0);

    test('a zone cancelled mid-pass is NOT resurrected', () {
      final snapshotEntry = entry(100, 0, t0, repeat: true);
      // Refresh computed a top-up for zone 100...
      final results = {
        100: (slot: 0, updated: snapshotEntry.copyWith(lastArrival: t1)),
      };
      // ...but the user cancelled it: current no longer has zone 100.
      final merged = TrainAlertController.mergeRefresh(
        current: const [],
        results: results,
      );
      expect(merged, isEmpty);
    });

    test('applies a top-up for a zone still present and unchanged', () {
      final e = entry(100, 0, t0, repeat: true);
      final merged = TrainAlertController.mergeRefresh(
        current: [e],
        results: {100: (slot: 0, updated: e.copyWith(lastArrival: t1))},
      );
      expect(merged, hasLength(1));
      expect(merged.single.lastArrival, t1);
    });

    test('a zone re-armed to a different slot keeps the current entry', () {
      final current = entry(100, 3, t1, repeat: true); // re-armed: slot 3
      final merged = TrainAlertController.mergeRefresh(
        current: [current],
        // stale result was computed against the old slot 0.
        results: {100: (slot: 0, updated: entry(100, 0, t0, repeat: true))},
      );
      expect(merged.single.slot, 3);
      expect(merged.single.lastArrival, t1);
    });

    test('a zone armed mid-pass (absent from results) is kept', () {
      final added = entry(200, 1, t1);
      final merged = TrainAlertController.mergeRefresh(
        current: [added],
        results: const {},
      );
      expect(merged, [added]);
    });

    test('drops an expired one-shot the refresh marked for removal', () {
      final e = entry(200, 1, t0); // one-shot
      final merged = TrainAlertController.mergeRefresh(
        current: [e],
        results: {200: (slot: 1, updated: null)}, // expired -> drop
      );
      expect(merged, isEmpty);
    });
  });
}
