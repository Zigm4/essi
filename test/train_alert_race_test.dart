import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/features/tools/train/domain/mars_express_models.dart';
import 'package:underdeck_app/services/notifications.dart';

/// Drives the [TrainAlertController] mutators end-to-end against a stubbed
/// flutter_local_notifications platform channel. Covers:
///   * E2 — a cancel that lands during a refresh window wins (serialized ops,
///     merge-onto-current-state; a cancelled zone is never resurrected).
///   * E4 — arming with nothing schedulable returns [ArmOutcome.nothingToSchedule]
///     and never leaves a phantom "armed" entry.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('dexterous.com/flutter/local_notifications');

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    // Register the Android plugin as the platform instance so the plugin's
    // calls route through the mocked channel below (no real device needed).
    AndroidFlutterLocalNotificationsPlugin.registerWith();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'pendingNotificationRequests':
          return <Map<Object?, Object?>>[];
        case 'requestNotificationsPermission':
        case 'requestPermissions':
        case 'canScheduleExactNotifications':
        case 'initialize':
          return true;
        default:
          return null;
      }
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    debugDefaultTargetPlatformOverride = null;
  });

  Future<TrainAlertController> controller() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    return TrainAlertController(prefs);
  }

  // A stop a few minutes ahead of real-now so nextOccurrences always yields a
  // schedulable arrival (>2 min out), regardless of when the test runs.
  List<TrainStop> soonStops(int zone) {
    final now = DateTime.now();
    return [TrainStop(minute: (now.minute + 5) % 60, zone: zone)];
  }

  test('cancel during a refresh window wins (E2)', () async {
    final c = await controller();
    final stops = soonStops(500);

    final armed = await c.arm(zone: 500, stops: stops, now: DateTime.now());
    expect(armed, ArmOutcome.armed);
    expect(c.state.isArmed(500), isTrue);

    // Fire a refresh (which reads a snapshot and does many awaits) and a cancel
    // without awaiting the refresh first — the classic resurrection race.
    final refreshFuture = c.refresh(stops);
    final cancelFuture = c.cancelZone(500);
    await Future.wait([refreshFuture, cancelFuture]);

    // The cancel must win: the zone stays cancelled, never resurrected.
    expect(c.state.isArmed(500), isFalse);
    c.dispose();
  });

  test('cancelAll during refresh wins (E2)', () async {
    final c = await controller();
    final stops = <TrainStop>[
      ...soonStops(500),
      ...soonStops(600),
    ];
    await c.arm(zone: 500, stops: stops, now: DateTime.now());
    await c.arm(zone: 600, stops: stops, now: DateTime.now());
    expect(c.state.zones, hasLength(2));

    final refreshFuture = c.refresh(stops);
    final cancelFuture = c.cancelAll();
    await Future.wait([refreshFuture, cancelFuture]);

    expect(c.state.zones, isEmpty);
    c.dispose();
  });

  test('arming with nothing schedulable leaves no phantom entry (E4)', () async {
    final c = await controller();
    // now is 1s before the :31 arrival: the arrival is <2s away and its earlier
    // alerts are in the past, so nothing is schedulable.
    final now = DateTime(2026, 7, 9, 8, 30, 59);
    final stops = const [TrainStop(minute: 31, zone: 700)];

    final outcome = await c.arm(zone: 700, stops: stops, now: now);
    expect(outcome, ArmOutcome.nothingToSchedule);
    expect(c.state.isArmed(700), isFalse); // no phantom armed entry
    c.dispose();
  });

  test('re-arming into an unschedulable window drops the stale entry (E4)',
      () async {
    final c = await controller();
    const stops = [TrainStop(minute: 31, zone: 700)];

    // First arm well ahead of the :31 arrival -> succeeds.
    final first =
        await c.arm(zone: 700, stops: stops, now: DateTime(2026, 7, 9, 8, 20));
    expect(first, ArmOutcome.armed);
    expect(c.state.isArmed(700), isTrue);

    // Re-arm 1s before the arrival -> nothing schedulable. The previously armed
    // entry must be dropped, not left as a phantom with cancelled ids.
    final second =
        await c.arm(zone: 700, stops: stops, now: DateTime(2026, 7, 9, 8, 30, 59));
    expect(second, ArmOutcome.nothingToSchedule);
    expect(c.state.isArmed(700), isFalse);
    c.dispose();
  });
}
