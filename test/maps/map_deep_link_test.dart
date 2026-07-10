import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/features/favorites/data/favorites_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/flat_map_viewport.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/globe_viewport.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/zone_sheet.dart';
import 'package:underdeck_app/services/app_settings.dart';

MapDocument _seed(String name) {
  final json = jsonDecode(
    File('assets/maps_seed/$name.map.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  return MapDocument.fromJson(json);
}

void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues(
        <String, Object>{'settings.reduceAnimations': true});
    prefs = await SharedPreferences.getInstance();
  });

  Widget wrap(Widget child) => ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          favoriteIdsProvider
              .overrideWith((ref, kind) => Stream.value(const <String>{})),
        ],
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(
            body: Center(
              child: SizedBox(width: 400, height: 400, child: child),
            ),
          ),
        ),
      );

  testWidgets('flat viewport pre-selects the deep-linked zone (ZoneSheet opens)',
      (tester) async {
    await tester.pumpWidget(wrap(
      FlatMapViewport(
        document: _seed('hideous-dungeon'),
        backgroundBytes: null,
        initialZoneId: 'z-flooded-crypt',
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(ZoneSheet), findsOneWidget);
    expect(find.text('Flooded Crypt'), findsWidgets);
  });

  testWidgets('globe viewport pre-selects + orients to the deep-linked zone',
      (tester) async {
    await tester.pumpWidget(wrap(
      GlobeViewport(
        document: _seed('keth-9'),
        initialZoneId: 's-umbral',
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(ZoneSheet), findsOneWidget);
    expect(find.text('Umbral Basin'), findsWidgets);
  });

  testWidgets('an unknown initialZoneId is a harmless no-op (no ZoneSheet)',
      (tester) async {
    await tester.pumpWidget(wrap(
      FlatMapViewport(
        document: _seed('hideous-dungeon'),
        backgroundBytes: null,
        initialZoneId: 'z-does-not-exist',
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(ZoneSheet), findsNothing);
  });
}
