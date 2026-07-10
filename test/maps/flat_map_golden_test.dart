import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:underdeck_app/features/favorites/data/favorites_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_pins_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_theme.dart';
import 'package:underdeck_app/features/knowledge/maps/render/flat_map_render_model.dart';
import 'package:underdeck_app/features/knowledge/maps/render/label_painter.dart';
import 'package:underdeck_app/features/knowledge/maps/render/selection_painter.dart';
import 'package:underdeck_app/features/knowledge/maps/render/zone_painter.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/zone_sheet.dart';

/// A compact flat map fixture: a holed polygon, a themed polygon, and a marker.
Map<String, dynamic> _fixtureJson() => {
      'schemaVersion': 1,
      'id': 'fixture',
      'type': 'flat',
      'canvas': {'width': 400, 'height': 300},
      'theme': {
        'background': '#05070D',
        'surface': '#101B2E',
        'zoneFill': '#1E3A55',
        'zoneStroke': '#4FC3FF',
        'zoneSelectedFill': '#7AE3FF',
        'glow': '#7AE3FF',
        'label': '#E8F4FF',
        'accent': '#FFB347',
        'fontFamily': 'Inter',
      },
      'fieldsSchema': [
        {
          'key': 'threat',
          'label': 'Threat',
          'type': 'enum',
          'options': ['low', 'deadly'],
          'searchable': true,
          'filterable': true,
        },
        {'key': 'loot', 'label': 'Loot', 'type': 'stringList'},
        {'key': 'notes', 'label': 'Notes', 'type': 'longText'},
        {'key': 'depth', 'label': 'Depth', 'type': 'number', 'unit': 'm'},
      ],
      'zones': [
        {
          'id': 'a',
          'name': 'Holed Hall',
          'geometry': {
            'kind': 'polygon',
            'rings': [
              [
                [40, 40],
                [180, 40],
                [180, 160],
                [40, 160]
              ],
              [
                [80, 80],
                [140, 80],
                [140, 120],
                [80, 120]
              ],
            ],
          },
          'labelAnchor': [110, 40],
          'fields': {
            'threat': 'low',
            'loot': ['Torch', 'Rope'],
            'notes': 'A wide chamber with a pit in the middle.',
            'depth': 12,
          },
        },
        {
          'id': 'b',
          'name': 'Red Crypt',
          'geometry': {
            'kind': 'polygon',
            'rings': [
              [
                [200, 120],
                [360, 120],
                [360, 260],
                [200, 260]
              ],
            ],
          },
          'labelAnchor': [280, 190],
          'themeOverride': {
            'zoneFill': '#3A1E2E',
            'zoneStroke': '#FF5577',
            'glow': '#FF5577',
          },
          'fields': {
            'threat': 'deadly',
            'loot': ['Reliquary', 'Pearl'],
            'notes': 'Black water to the knee. Do not linger.',
            'depth': 40,
          },
        },
        {
          'id': 'm',
          'name': 'Cache',
          'geometry': {
            'kind': 'marker',
            'at': [310, 60],
            'hitRadius': 30,
          },
          'labelAnchor': [310, 30],
          'fields': {'threat': 'low', 'loot': ['Coins']},
        },
      ],
    };

Widget _boundary({required Key key, required Size size, required Widget child}) {
  return Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: RepaintBoundary(
        key: key,
        child: SizedBox.fromSize(size: size, child: child),
      ),
    ),
  );
}

void main() {
  testWidgets('ZonePainter + SelectionPainter golden (fixture map)',
      (tester) async {
    final render = buildFlatMapRender(MapDocument.fromJson(_fixtureJson()));
    final selected =
        render.items.firstWhere((i) => i.zoneId == 'b'); // themed selection
    final size = render.canvasSize;
    const key = ValueKey('flat-map-canvas');

    await tester.pumpWidget(
      _boundary(
        key: key,
        size: size,
        child: Stack(
          children: [
            Positioned.fill(child: ColoredBox(color: render.theme.background)),
            CustomPaint(
              size: size,
              painter: ZonePainter(render: render, labelsVisible: true),
            ),
            CustomPaint(
              size: size,
              painter:
                  SelectionPainter(selected: selected, canvasSize: size),
            ),
            CustomPaint(
              size: size,
              painter: LabelPainter(render: render, visible: true),
            ),
          ],
        ),
      ),
    );

    await expectLater(
      find.byKey(key),
      matchesGoldenFile('goldens/flat_map_zones.png'),
    );
  });

  group('ZoneSheet golden', () {
    Future<void> pumpSheet(
      WidgetTester tester, {
      required MapDocument doc,
      required MapTheme theme,
      required String goldenName,
    }) async {
      final zone = doc.zones.firstWhere((z) => z.id == 'b');
      const key = ValueKey('zone-sheet');
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // Keep the favorite toggle off the real database in tests.
            favoriteIdsProvider.overrideWith(
              (ref, kind) => Stream.value(const <String>{}),
            ),
            // Keep the zone-note lookup off the real database too.
            zonePinProvider.overrideWith((ref, key) => Stream.value(null)),
          ],
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              backgroundColor: theme.background,
              body: Center(
                child: RepaintBoundary(
                  key: key,
                  child: SizedBox(
                    width: 380,
                    height: 560,
                    child: ZoneSheet(
                      zone: zone,
                      fieldsSchema: doc.fieldsSchema,
                      theme: theme,
                      mapId: doc.id,
                      scrollController: ScrollController(),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(find.byKey(key), matchesGoldenFile(goldenName));
    }

    testWidgets('default theme', (tester) async {
      final doc = MapDocument.fromJson(_fixtureJson());
      await pumpSheet(
        tester,
        doc: doc,
        theme: MapTheme.defaults.sanitize(),
        goldenName: 'goldens/zone_sheet_default.png',
      );
    });

    testWidgets('per-map (red crypt) theme', (tester) async {
      final doc = MapDocument.fromJson(_fixtureJson());
      // The zone's resolved theme: map theme + the crypt's override.
      final zone = doc.zones.firstWhere((z) => z.id == 'b');
      final theme = doc.theme.sanitize().withOverride(zone.themeOverride);
      await pumpSheet(
        tester,
        doc: doc,
        theme: theme,
        goldenName: 'goldens/zone_sheet_crypt.png',
      );
    });
  });
}
