import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/train/domain/mars_express_models.dart';

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
}
