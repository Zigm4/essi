import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'next_arrival_provider.dart';

/// The platform sink the [LiveActivityBridge] writes the flat bridge payload to.
///
/// This is the ONE seam between the pure Flutter-side snapshot and the native
/// Live Activity / Dynamic Island / home-screen widget layer. The default
/// [NoopLiveActivitySink] does nothing, so the wiring can exist and be
/// unit-tested today with **zero native dependencies**. The real
/// implementations (ActivityKit via `live_activities`, home-screen widgets via
/// `home_widget`, Android Glance) are dropped in behind this interface during
/// the device-work phase — see docs/LIVE_ACTIVITY_PLAN.md §7. Nothing else in
/// the app talks to the native side directly.
abstract class LiveActivitySink {
  /// Hand the flat, JSON-safe payload (see [NextArrivalSnapshot.toBridgeMap])
  /// to the native surface: write it to the shared App-Group store and, when
  /// [Map] `isArmed == true`, start/update a Live Activity.
  Future<void> push(Map<String, Object?> payload);

  /// There is nothing to track (idle, nothing armed). Clear the widget and end
  /// any running Live Activity.
  Future<void> clear();
}

/// The default sink: a **deliberate no-op**. It exists so the bridge is fully
/// wired and verifiable before any native plugin ships. Swapping in the real
/// sink is a single override of [liveActivitySinkProvider] — no call site in
/// the app changes.
class NoopLiveActivitySink implements LiveActivitySink {
  const NoopLiveActivitySink();

  @override
  Future<void> push(Map<String, Object?> payload) async {
    // Intentionally does nothing. The native ActivityKit / Glance / home_widget
    // implementation lands in the device-work phase (LIVE_ACTIVITY_PLAN.md §4–6).
  }

  @override
  Future<void> clear() async {
    // Intentionally does nothing (see [push]).
  }
}

/// Turns the current [NextArrivalSnapshot] into the flat native payload and
/// hands it to a [LiveActivitySink]. Pure apart from the sink call, so it is
/// unit-testable with a fake sink and carries **no** native dependencies.
///
/// The bridge intentionally does not re-derive any schedule math: it only ever
/// forwards [NextArrivalSnapshot.toBridgeMap], so the schedule logic lives in
/// exactly one place ([resolveNextArrival]).
class LiveActivityBridge {
  const LiveActivityBridge({this.sink = const NoopLiveActivitySink()});

  final LiveActivitySink sink;

  /// The exact flat map the future native widget/Live Activity consumes, or
  /// `null` when there is nothing to show. A straight passthrough of
  /// [NextArrivalSnapshot.toBridgeMap] so the payload contract has one owner.
  static Map<String, Object?>? payloadFor(NextArrivalSnapshot? snapshot) =>
      snapshot?.toBridgeMap();

  /// Reconcile the sink with [snapshot]: push the payload when there is a
  /// snapshot to track, otherwise clear. Returns the payload that was pushed
  /// (or `null` when it cleared) so callers and tests can assert on it.
  Future<Map<String, Object?>?> sync(NextArrivalSnapshot? snapshot) async {
    final payload = payloadFor(snapshot);
    if (payload == null) {
      await sink.clear();
    } else {
      await sink.push(payload);
    }
    return payload;
  }
}

/// The active [LiveActivitySink]. Defaults to the no-op; the device-work phase
/// overrides this provider with the real native sink (see LIVE_ACTIVITY_PLAN.md).
/// Overriding it here is the single wiring change needed to light up the native
/// surface.
final liveActivitySinkProvider = Provider<LiveActivitySink>(
  (ref) => const NoopLiveActivitySink(),
);

/// The [LiveActivityBridge], wired to the active [liveActivitySinkProvider].
final liveActivityBridgeProvider = Provider<LiveActivityBridge>(
  (ref) => LiveActivityBridge(sink: ref.watch(liveActivitySinkProvider)),
);

/// Keeps the native Live Activity / widget in sync with [nextArrivalProvider]
/// for the whole lifetime of this listener. This is the ONE place that pushes
/// snapshots to the native side: watch it (e.g. `ref.watch(liveActivitySyncProvider)`)
/// from the Mars Express surface so every recomputed snapshot — on a clock
/// tick, a schedule load, or an armed-zone change — is forwarded to the sink.
///
/// With the default [NoopLiveActivitySink] this is a harmless no-op, so it is
/// safe to wire now; it starts doing real work the moment the native sink is
/// installed. `autoDispose` so it tears down with the surface that listens.
final liveActivitySyncProvider = Provider.autoDispose<void>((ref) {
  final bridge = ref.watch(liveActivityBridgeProvider);
  ref.listen<NextArrivalSnapshot?>(
    nextArrivalProvider,
    (_, next) => bridge.sync(next),
    fireImmediately: true,
  );
});
