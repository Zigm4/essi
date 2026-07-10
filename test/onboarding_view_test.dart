import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/features/onboarding/onboarding_view.dart';
import 'package:underdeck_app/services/app_settings.dart';

/// P3 point 23: first-run onboarding shows exactly once and flips the
/// persisted `onboardingSeen` flag on completion / skip.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<SharedPreferences> prefs() async {
    SharedPreferences.setMockInitialValues({});
    return SharedPreferences.getInstance();
  }

  Widget harness(SharedPreferences p) {
    final router = GoRouter(
      initialLocation: '/onboarding',
      routes: [
        GoRoute(
          path: '/onboarding',
          builder: (context, state) => const OnboardingView(),
        ),
        GoRoute(
          path: '/tools',
          builder: (context, state) => const Text('TOOLS_HOME'),
        ),
      ],
    );
    return ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(p)],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('walks all three pages and finishing sets the flag',
      (tester) async {
    final p = await prefs();
    await tester.pumpWidget(harness(p));
    await tester.pumpAndSettle();

    // Page 1.
    expect(find.text('What Underdeck is'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);

    // Advance to page 2.
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('The tools & SL-sectors'), findsOneWidget);

    // Advance to page 3 — last page shows the enter CTA.
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Privacy promise'), findsOneWidget);
    expect(find.text('Enter Underdeck'), findsOneWidget);

    // Finishing flips the persisted flag and lands on the app.
    await tester.tap(find.text('Enter Underdeck'));
    await tester.pumpAndSettle();
    expect(find.text('TOOLS_HOME'), findsOneWidget);

    final notifier = AppSettingsNotifier(p);
    expect(notifier.state.onboardingSeen, isTrue);
  });

  testWidgets('Skip sets the flag and leaves onboarding', (tester) async {
    final p = await prefs();
    await tester.pumpWidget(harness(p));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    expect(find.text('TOOLS_HOME'), findsOneWidget);
    expect(p.getBool('settings.onboardingSeen'), isTrue);
  });
}
