# Migration notes

## Android applicationId rename (v0.2.0)

The Android application id (and Gradle namespace) was renamed:

| Before                          | After                       |
| ------------------------------- | --------------------------- |
| `xyz.overthecloud.underdeck_app` | `xyz.overthecloud.underdeck` |

Both are set in `android/app/build.gradle.kts` (`namespace` and
`applicationId`).

### Why this needs a one-time handoff

Android treats the `applicationId` as the package identity. A build with the new
id is a **different app** to the OS, so it will **not** upgrade an existing
install of the old id. Instead:

- The store/sideload treats it as a fresh install, installed side by side.
- Each app has its own private sandbox, so the **local SQLite database and
  `shared_preferences` of the old build are not visible to the new build**.
- Uninstalling the old app deletes its sandbox — and with it, the only copy of
  a tester's local data (notes, links, hangar, scan/tracker/discovery history,
  settings). Underdeck has no backend, so there is nothing to re-sync from.

iOS is unaffected: the bundle identifier there was not part of this rename.

### One-time export → import handoff for existing testers

Because P2 ships the JSON export/import feature (Settings → Data), existing
testers can carry their data across the rename manually:

1. **Before removing the old build**, open the old app → **Settings → Data →
   Export…** and save/share the JSON file somewhere durable (Files, email,
   AirDrop, cloud drive).
2. Install the new build (`xyz.overthecloud.underdeck`).
3. Open the new app → **Settings → Data → Import…** and pick the JSON file
   exported in step 1.
4. Verify the data is present, then uninstall the old
   `xyz.overthecloud.underdeck_app` build.

> **Order matters:** export from the old app *first*. Once the old build is
> uninstalled its sandboxed data is gone for good.

New testers installing the renamed build for the first time have nothing to
migrate and can ignore this note.

## iOS: Time Sensitive Notifications capability (required for release)

P2 wires `ios/Runner/Runner.entitlements` (referenced from all three Runner
build configs via `CODE_SIGN_ENTITLEMENTS`) so Mars Express alerts use the
`timeSensitive` interruption level and can break through Focus / Do Not Disturb.

That entitlement (`com.apple.developer.usernotifications.time-sensitive`) must
be enabled on the **App ID** in the Apple Developer portal (and carried by the
provisioning profile). Until it is:

- **Automatic signing** in Xcode will usually add it for you when the account
  allows it.
- **Manual signing / CI** with a profile that lacks the capability will **fail
  to code-sign** the build.

If you are not ready to enable it, remove the `CODE_SIGN_ENTITLEMENTS` line from
the three Runner configs in `ios/Runner.xcodeproj/project.pbxproj` (alerts then
fall back to the standard interruption level — they still fire, just not through
Focus).
