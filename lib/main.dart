import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/logging.dart';
import 'services/app_settings.dart';
import 'services/notifications.dart';

Future<void> main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Route framework and platform errors through the shared logger so nothing
    // is silently swallowed.
    FlutterError.onError = (details) {
      logError(details.exception, details.stack);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      logError(error, stack);
      return true;
    };

    // Type is bundled as assets (see pubspec `fonts:`); never fetch from
    // fonts.gstatic.com at runtime (privacy + offline first-paint). The app no
    // longer calls GoogleFonts.* directly, but this is a hard guard in case a
    // stray call sneaks back in.
    GoogleFonts.config.allowRuntimeFetching = false;

    // Register the bundled fonts' SIL Open Font Licenses so they surface in the
    // in-app license page (google_fonts only self-registers licences for the
    // fonts it fetches at runtime, which we no longer do).
    LicenseRegistry.addLicense(() async* {
      for (final family in const ['Inter', 'JetBrainsMono', 'Quicksand']) {
        final license =
            await rootBundle.loadString('assets/fonts/$family-OFL.txt');
        yield LicenseEntryWithLineBreaks([family], license);
      }
    });

    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Color(0x00000000),
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF03060B),
      systemNavigationBarIconBrightness: Brightness.light,
    ));

    // A notification-plugin init failure must not leave the user on a
    // permanent blank screen — degrade gracefully and continue booting.
    try {
      await AppNotifications.initialize();
    } catch (e, st) {
      logError('AppNotifications.initialize() failed: $e', st);
    }

    final prefs = await SharedPreferences.getInstance();
    runApp(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const UnderdeckApp(),
      ),
    );
  }, (error, stack) {
    logError(error, stack);
  });
}
