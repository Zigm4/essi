import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/features/favorites/data/favorites_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_pins_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/globe_viewport.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/zone_sheet.dart';
import 'package:underdeck_app/services/app_settings.dart';

MapDocument _seedKeth9() {
  final json = jsonDecode(
    File('assets/maps_seed/keth-9.map.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  return MapDocument.fromJson(json);
}

void main() {
  late SharedPreferences prefs;

  setUp(() async {
    // reduceAnimations = true → decorative auto-rotate is OFF, so the orientation
    // stays fixed at the map's initial camera for the whole test (deterministic).
    SharedPreferences.setMockInitialValues(
        <String, Object>{'settings.reduceAnimations': true});
    prefs = await SharedPreferences.getInstance();
  });

  Future<Rect> pumpViewport(WidgetTester tester) async {
    final doc = _seedKeth9();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          // Keep the favorite toggle in the ZoneSheet off the real database.
          favoriteIdsProvider.overrideWith(
            (ref, kind) => Stream.value(const <String>{}),
          ),
          // Keep the zone-note lookup off the real database too.
          zonePinProvider.overrideWith((ref, key) => Stream.value(null)),
        ],
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 400,
                height: 400,
                child: GlobeViewport(document: doc),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return tester.getRect(find.byType(GlobeViewport));
  }

  testWidgets('tap near the centre selects a zone (opens its ZoneSheet)',
      (tester) async {
    final rect = await pumpViewport(tester);

    // The initial camera centres (lon 0, lat 8) — inside the Rustwind Reach
    // equatorial sector. A tap at the disc centre must pick a zone.
    await tester.tapAt(rect.center);
    await tester.pumpAndSettle();

    expect(find.byType(ZoneSheet), findsOneWidget);
    expect(find.text('Rustwind Reach'), findsWidgets);
  });

  testWidgets('a limb tap does not select a zone', (tester) async {
    final rect = await pumpViewport(tester);

    // Radius = min(w,h)/2 * 0.92 = 184 px. A tap 178 px above centre sits on the
    // globe (0.97R) but past the 0.95R limb-pick limit → unproject returns null
    // → no selection.
    final limb = rect.center + const Offset(0, -178);
    await tester.tapAt(limb);
    await tester.pumpAndSettle();

    expect(find.byType(ZoneSheet), findsNothing);
  });
}
