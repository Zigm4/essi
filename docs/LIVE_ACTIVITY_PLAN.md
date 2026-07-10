# Live Activity / Dynamic Island + Home-Screen Widget — Mars Express (P3 point 20)

Status: **groundwork + plan landed; native UI pending device work.**

This document is the implementation plan for the glanceable "next Mars Express
arrival" surface on iOS (ActivityKit Live Activity + Dynamic Island +
WidgetKit) and Android (Glance AppWidget). The Flutter-side single source of
truth already exists (see [Groundwork already landed](#groundwork-already-landed)).
The native extension targets are **deliberately not added here** — they cannot be
verified headless and would risk the working iOS build. They are the "device
work" phase below.

---

## 1. User value

A rider glances at their lock screen, Dynamic Island, or home screen and
immediately sees:

> **Zone 301 · Redwater Junction — arriving in 3 min (at :10)**

with a live countdown, without opening the app. When an alert is armed for a
zone, a Live Activity starts automatically and counts down through the same
2-min / 1-min / arrival beats the notification layer already uses.

## 2. Data contract (the single source of truth)

The native layer must **never re-implement the schedule math.** It consumes the
snapshot produced by
`lib/features/tools/train/state/next_arrival_provider.dart`:

`NextArrivalSnapshot.toBridgeMap()` →

| key                  | type   | meaning                                              |
| -------------------- | ------ | ---------------------------------------------------- |
| `zone`               | int    | zone the widget tracks (armed zone, else live stop)  |
| `zoneName`           | string?| human stop name if the schedule has one              |
| `arrivalMinute`      | int    | wall-clock minute 0–59 of the next arrival           |
| `minutesUntil`       | int    | whole minutes until arrival, rounded up, `>= 0`      |
| `arrivalEpochMs`     | int    | absolute arrival instant (drives the native timer)   |
| `isArmed`            | bool   | user has an alert armed for this zone                 |
| `generatedAtEpochMs` | int    | when the snapshot was computed (staleness detection)  |

Focused-zone rule (already implemented in `MarsExpressNextArrival.focusedZone`):
first **armed** zone wins; otherwise the zone the train is at *right now*;
otherwise nothing (idle → no Live Activity, empty widget placeholder).

The native side should prefer driving the countdown off `arrivalEpochMs` with a
native `Text(timerInterval:)` / `TimeInterval` timer rather than pushing a new
snapshot every minute — that keeps updates cheap and battery-friendly (see §5).

Concrete example of one `toBridgeMap()` payload (zone 400 "Olympus", armed, 20
min out) as it crosses the channel:

```json
{
  "zone": 400,
  "zoneName": "Olympus",
  "arrivalMinute": 20,
  "minutesUntil": 20,
  "arrivalEpochMs": 1783080000000,
  "isArmed": true,
  "generatedAtEpochMs": 1783078800000
}
```

The map is intentionally flat (no nesting) and JSON-safe (ints / string /
bool). This is asserted by `test/live_activity_bridge_test.dart` and
`test/next_arrival_snapshot_test.dart` so a schema drift breaks the build, not
the device.

## 3. Recommended packages

- **`home_widget`** — home-screen widgets on both platforms and a shared
  App-Group key/value bridge (iOS `UserDefaults(suiteName:)` + Android
  `SharedPreferences`). Also exposes `HomeWidget.registerInteractivityCallback`
  and background update hooks.
- **`live_activities`** — starts/updates/ends iOS Live Activities from Dart and
  passes a typed payload to the ActivityKit `ActivityAttributes`.
- Android Live-Activity equivalent: a **Glance** `GlanceAppWidget` updated by a
  **`WorkManager`** periodic worker (no ActivityKit analogue; the ongoing
  notification from `flutter_local_notifications` already covers the alerting
  path).

Add these to `pubspec.yaml` **only in the device-work phase** — they pull native
plugin code and must be built/tested on a real device. Do not add them in this
groundwork pass.

## 4. iOS steps (ActivityKit + WidgetKit)

1. **Widget extension target** (`Runner Widget Extension`) added in Xcode.
   Do NOT hand-edit `project.pbxproj`; add via Xcode so the build settings and
   embedding are correct.
2. **App Group** (`group.at.marchetto.underdeck.mars`) enabled on both the app
   and the extension; both read/write the shared `UserDefaults` suite. The
   Flutter side writes the bridge map (via `home_widget`), the extension reads
   it.
3. **Entitlements**: App Group on both targets; `NSSupportsLiveActivities = YES`
   in `Info.plist`.
4. **`ActivityAttributes`** mirroring the data contract: static `zone`,
   `zoneName`; dynamic `ContentState { arrival: Date, minutesUntil, isArmed }`.
5. **Live Activity layouts**: lock-screen banner + Dynamic Island
   (compact leading = zone, compact trailing = `Text(arrival, style: .timer)`,
   expanded = zone name + countdown + next-hour hint). Colours mirror the app's
   neon design tokens.
6. **WidgetKit widget**: a `TimelineProvider` whose entries are the upcoming
   arrivals for the focused zone (computed from the last-written snapshot), with
   `.after(nextArrival)` reload policy so the OS refreshes on the wall-clock
   minute boundary.
7. **Start/stop**: when Dart arms a zone, start the Live Activity with the
   snapshot; when disarmed / after arrival, end it.

## 5. Background update strategy (wall-clock-minute schedule)

The schedule is deterministic and minute-aligned, so we do **not** need frequent
pushes:

- Compute the snapshot once, write `arrivalEpochMs`, and let the OS render a
  self-updating timer (`Text(_, style: .timer)` / `Text(timerInterval:)`). No
  per-second work.
- Refresh the written snapshot at the app's existing top-up moments: **on app
  resume** (matches `MarsExpressView.didChangeAppLifecycleState`) and whenever
  the armed-zone set changes.
- iOS: schedule a **`BGAppRefreshTask`** to re-write the snapshot roughly hourly
  so the widget stays fresh across the hour wrap. WidgetKit timeline
  `.after(...)` handles intra-hour rollover without waking the app.
- Android: a **`WorkManager`** periodic worker (min 15 min) re-writes the
  snapshot and calls `HomeWidget.updateWidget`.
- On arrival, advance to the next occurrence (reuse
  `MarsExpressService.nextOccurrences`) — the Dart provider already wraps into
  the next hour, so the bridge just re-reads it.

## 6. Android steps (Glance AppWidget)

1. `GlanceAppWidget` + `GlanceAppWidgetReceiver` registered in the Android
   manifest (device-work phase — not edited here).
2. Widget UI reads the shared prefs keys written by `home_widget` and renders
   zone + countdown, styled to the neon palette.
3. A `WorkManager` periodic worker re-writes the snapshot and triggers
   `updateAll`. The existing ongoing notification remains the primary alerting
   channel.

## 7. Flutter wiring (how it reuses the schedule math)

```
marsExpressScheduleProvider  ─┐
nextArrivalClockProvider ─────┼─▶ nextArrivalProvider ─▶ NextArrivalSnapshot
trainAlertControllerProvider ─┘        (single source of truth)
                                            │  .toBridgeMap()
                                            ▼
                             LiveActivityBridge.sync(snapshot)
                                            │        (bridge, landed)
                                            ▼
                                    LiveActivitySink
                     ┌──────────────────┴───────────────────┐
              NoopLiveActivitySink                  <native sink>
                (default, landed)              (device-work phase)
                                        ├─ HomeWidget.saveWidgetData / updateWidget
                                        └─ LiveActivities.createActivity / updateActivity
```

### 7.1 The bridge — landed, no native deps

`lib/features/tools/train/state/live_activity_bridge.dart` is the ONE seam
between the pure snapshot and the native side. It ships today with **zero**
native dependencies:

- **`LiveActivitySink`** — the abstract platform sink. `push(payload)` writes
  the flat map to the shared App-Group store and (when `isArmed`) starts/updates
  a Live Activity; `clear()` ends it. Nothing else in the app talks to the
  native layer directly.
- **`NoopLiveActivitySink`** — the default: a deliberate no-op so the wiring is
  live and unit-tested before any plugin exists.
- **`LiveActivityBridge`** — `payloadFor(snapshot)` (a straight passthrough of
  `NextArrivalSnapshot.toBridgeMap()`, so the payload contract has one owner)
  and `sync(snapshot)` (push when there is a snapshot, else clear).
- **Providers** — `liveActivitySinkProvider` (defaults to the no-op),
  `liveActivityBridgeProvider`, and `liveActivitySyncProvider` (an
  `autoDispose` listener that forwards every recomputed `nextArrivalProvider`
  snapshot to the sink). The Mars Express surface `ref.watch`es
  `liveActivitySyncProvider` so the wiring is active whenever that surface is on
  screen.

### 7.2 Installing the real native sink (device-work phase)

Adding native support is a **single override** — no call site changes:

```dart
ProviderScope(
  overrides: [
    liveActivitySinkProvider.overrideWithValue(NativeLiveActivitySink()),
  ],
  child: const UnderdeckApp(),
);
```

`NativeLiveActivitySink implements LiveActivitySink` wraps `home_widget` +
`live_activities` (added to `pubspec.yaml` only in this phase) and is a **no-op
on unsupported platforms** so the core app is unaffected.

Because everything derives from `nextArrivalProvider`, which derives purely from
`resolveNextArrival` (`MarsExpressService` + a caller-supplied wall clock), the
schedule logic lives in exactly one place. The countdown is genuinely live: the
provider watches `nextArrivalClockProvider`, a minute-cadence `autoDispose`
clock, so it re-resolves as time passes instead of serving a memoized value.

## 8. Groundwork already landed

- `lib/features/tools/train/state/next_arrival_provider.dart`
  - `NextArrivalSnapshot` (+ `toBridgeMap()`),
  - `MarsExpressNextArrival` pure resolver (`focusedZone` / `build` / `resolve`),
  - `resolveNextArrival({schedule, armedZones, required now})` — the pure,
    caller-clocked entry point (no hidden memoization),
  - `nextArrivalClockProvider` — an `autoDispose` minute-cadence wall clock,
  - `nextArrivalProvider` — `autoDispose`, combines schedule + armed zones + the
    live clock so the countdown is genuinely fresh (fixes E3: the old plain
    `Provider` was memoized and could serve a stale countdown despite the
    "re-read = fresh" doc).
- `lib/features/tools/train/state/live_activity_bridge.dart`
  - `LiveActivitySink` / `NoopLiveActivitySink`, `LiveActivityBridge`,
    `liveActivitySinkProvider` / `liveActivityBridgeProvider` /
    `liveActivitySyncProvider` (see §7.1).
- `test/next_arrival_snapshot_test.dart` — snapshot + `resolveNextArrival` cases
  (incl. the "later clock → fresher countdown" contract).
- `test/live_activity_bridge_test.dart` — bridge push/clear + flat-payload cases.

No native dependencies were added to `pubspec.yaml`; no extension targets or
manifests were touched.

## 9. Testing note

The Live Activity, Dynamic Island, and home-screen widget **cannot be verified
in the simulator's headless/CI path** — they require a **real device** (Live
Activities need a physical iPhone with the Dynamic Island / lock-screen surface,
and App-Group + background-refresh behaviour differs from the simulator). Plan
for on-device QA when the native phase begins.
