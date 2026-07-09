import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// App version + build number read from the platform bundle at runtime (F67),
/// so version strings live in one place (pubspec) instead of being hardcoded in
/// several views.
class AppVersion {
  const AppVersion({required this.version, required this.buildNumber});

  /// e.g. "0.2.0".
  final String version;

  /// e.g. "5".
  final String buildNumber;

  /// "v0.2.0" — the short label shown in menus / about.
  String get shortLabel => 'v$version';

  /// "v0.2.0 (5)" — includes the build number for support/debug contexts.
  String get fullLabel => 'v$version ($buildNumber)';

  /// Fallback used while the async lookup is in flight or if it fails, so the
  /// UI never shows an empty string. Mirrors pubspec's `version:`.
  static const fallback = AppVersion(version: '0.2.0', buildNumber: '0');
}

/// Async provider exposing the app version. Consume with `.valueOrNull` and fall
/// back to [AppVersion.fallback] so callers never block first paint on it.
final appVersionProvider = FutureProvider<AppVersion>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return AppVersion(
    version: info.version,
    buildNumber: info.buildNumber,
  );
});
