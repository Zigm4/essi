import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/train/domain/mars_express_models.dart';
import 'package:underdeck_app/features/tools/train/state/live_activity_bridge.dart';
import 'package:underdeck_app/features/tools/train/state/next_arrival_provider.dart';

/// A recording [LiveActivitySink] so the bridge's push/clear reconciliation can
/// be asserted without any native plugin.
class _RecordingSink implements LiveActivitySink {
  final List<Map<String, Object?>> pushes = [];
  int clears = 0;

  @override
  Future<void> push(Map<String, Object?> payload) async => pushes.add(payload);

  @override
  Future<void> clear() async => clears++;
}

void main() {
  const schedule = MarsExpressSchedule([
    TrainStop(minute: 5, zone: 300),
    TrainStop(minute: 20, zone: 400, name: 'Olympus'),
  ]);

  NextArrivalSnapshot armedSnapshot() => resolveNextArrival(
        schedule: schedule,
        armedZones: const [400],
        now: DateTime(2026, 7, 10, 10, 0),
      )!;

  test('payloadFor forwards toBridgeMap() verbatim', () {
    final snap = armedSnapshot();
    expect(LiveActivityBridge.payloadFor(snap), snap.toBridgeMap());
  });

  test('payloadFor(null) is null (nothing to show)', () {
    expect(LiveActivityBridge.payloadFor(null), isNull);
  });

  test('sync pushes the flat payload for a live snapshot', () async {
    final sink = _RecordingSink();
    final bridge = LiveActivityBridge(sink: sink);
    final snap = armedSnapshot();

    final pushed = await bridge.sync(snap);

    expect(sink.pushes, hasLength(1));
    expect(sink.clears, 0);
    expect(pushed, snap.toBridgeMap());
    // The payload is flat + JSON-safe: only primitives, no nested maps.
    expect(sink.pushes.single['zone'], 400);
    expect(sink.pushes.single['minutesUntil'], 20);
    expect(sink.pushes.single['isArmed'], true);
    expect(sink.pushes.single['arrivalEpochMs'], isA<int>());
  });

  test('sync clears when there is nothing to track', () async {
    final sink = _RecordingSink();
    final bridge = LiveActivityBridge(sink: sink);

    final pushed = await bridge.sync(null);

    expect(pushed, isNull);
    expect(sink.pushes, isEmpty);
    expect(sink.clears, 1);
  });

  test('default sink is a no-op that never throws', () async {
    const bridge = LiveActivityBridge();
    await bridge.sync(armedSnapshot());
    await bridge.sync(null);
  });
}
