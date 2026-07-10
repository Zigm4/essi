# underdeck_app

Underdeck companion app for Underpunks55, cross platform iOS and Android

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request. It sets up
Flutter (stable, pinned to the SDK in `pubspec.yaml`), then runs:

1. `flutter pub get`
2. `dart run build_runner build --delete-conflicting-outputs` (drift + riverpod codegen)
3. `flutter analyze`
4. `flutter test`

The workflow starts running automatically as soon as the repository has a
GitHub remote — push this file and open a pull request to trigger it. No
secrets or external accounts are required.

## Crash reporting

All caught and uncaught errors flow through a single sink, `logError` in
`lib/core/logging.dart` (wired into `runZonedGuarded`,
`FlutterError.onError`, and `PlatformDispatcher.onError` in `main.dart`).

By default errors are only printed to the console in debug builds. To ship
crashes to a real backend (Sentry, Crashlytics, …), attach an `ErrorReporter`
in **one** place — `main.dart`, after the SDK is initialized — with no call-site
changes:

```dart
await SentryFlutter.init((o) => o.dsn = '<DSN>');
setErrorReporter((error, stack) => Sentry.captureException(error, stackTrace: stack));
```

See the wiring note in `lib/core/logging.dart` for details.
