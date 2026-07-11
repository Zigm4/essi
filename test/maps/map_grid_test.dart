import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/features/favorites/data/favorites_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_fts_index.dart';
import 'package:underdeck_app/features/knowledge/maps/data/map_pins_repository.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/maps_domain.dart';
import 'package:underdeck_app/features/knowledge/maps/render/globe_painter.dart';
import 'package:underdeck_app/features/knowledge/maps/render/sphere_math.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/globe_viewport.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/map_grid_view.dart';
import 'package:underdeck_app/features/knowledge/maps/widgets/zone_sheet.dart';
import 'package:underdeck_app/services/app_settings.dart';

const _validator = MapContentValidator();

/// The CONTRACT fixture: a small 4×3 grid-sphere doc — 3 zones addressed by
/// gridPos (no geometry), one of them explored (themeOverride).
Map<String, dynamic> _gridDocJson({
  Map<String, dynamic>? grid,
  List<Map<String, dynamic>>? zones,
}) =>
    {
      'schemaVersion': 2,
      'id': 'venus-mini',
      'type': 'sphere',
      'sphere': {
        'textureAsset': 'texture',
        'initialOrientation': {'lat': 0.0, 'lon': 0.0},
        'autoRotateDegPerSec': 0.0,
      },
      'grid': grid ?? {'cols': 4, 'rows': 3},
      'theme': const <String, dynamic>{},
      'fieldsSchema': const <Map<String, dynamic>>[],
      'zones': zones ??
          [
            {'id': 'c-0-0', 'name': 'Zone 1', 'gridPos': [0, 0], 'cellNum': 1},
            {
              'id': 'c-2-1',
              'name': 'Basalt Steppe',
              'gridPos': [2, 1],
              'cellNum': 7,
              'themeOverride': {'zoneFill': '#7A3CC2'},
              'fields': {'note': 'landing site'},
            },
            {'id': 'c-3-2', 'name': 'Zone 12', 'gridPos': [3, 2], 'cellNum': 12},
          ],
    };

MapParseResult<MapDocument> _validate(Map<String, dynamic> json) =>
    _validator.validateDocument(json, byteLength: 2048);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('grid contract — parsing', () {
    test('grid doc parses: grid, gridPos, cellNum; validator accepts', () {
      final r = _validate(_gridDocJson());
      expect(r, isA<MapParseOk<MapDocument>>());
      final doc = r.valueOrNull!;
      expect(doc.grid, isNotNull);
      expect(doc.grid!.cols, 4);
      expect(doc.grid!.rows, 3);
      final z = doc.zones.firstWhere((z) => z.id == 'c-2-1');
      expect(z.geometry, isNull);
      expect(z.gridPos, const GridPos(2, 1));
      expect(z.cellNum, 7);
      expect(z.themeOverride, isNotNull);
    });

    test('a zone with neither geometry nor gridPos in a grid doc is structural',
        () {
      final r = _validate(_gridDocJson(zones: [
        {'id': 'broken', 'name': 'No address'},
      ]));
      expect((r as MapParseError).code, MapValidationCode.malformedStructure);
    });

    test('a malformed gridPos with no geometry is structural too', () {
      final r = _validate(_gridDocJson(zones: [
        {'id': 'broken', 'name': 'Bad pos', 'gridPos': ['a', 'b']},
      ]));
      expect((r as MapParseError).code, MapValidationCode.malformedStructure);
    });

    test('a geometry-less zone outside a grid doc stays structural', () {
      final json = _gridDocJson(zones: [
        {'id': 'z', 'name': 'z', 'gridPos': [0, 0]},
      ])..remove('grid');
      final r = _validate(json);
      expect((r as MapParseError).code, MapValidationCode.malformedStructure);
    });

    test('explicit geometry is still allowed alongside grid zones', () {
      final r = _validate(_gridDocJson(zones: [
        {'id': 'c-0-0', 'name': 'Zone 1', 'gridPos': [0, 0]},
        {
          'id': 'cap',
          'name': 'Polar Crown',
          'geometry': {
            'kind': 'sphericalCap',
            'center': [0, 88],
            'radiusDeg': 6,
          },
        },
      ]));
      expect(r.isOk, isTrue);
    });
  });

  group('grid contract — validator bounds', () {
    test('duplicate gridPos rejected', () {
      final r = _validate(_gridDocJson(zones: [
        {'id': 'a', 'name': 'A', 'gridPos': [1, 1]},
        {'id': 'b', 'name': 'B', 'gridPos': [1, 1]},
      ]));
      final err = r as MapParseError<MapDocument>;
      expect(err.code, MapValidationCode.invalidBounds);
      expect(err.message, contains('duplicate gridPos'));
    });

    test('gridPos out of range rejected', () {
      final r = _validate(_gridDocJson(zones: [
        {'id': 'a', 'name': 'A', 'gridPos': [4, 0]}, // col == cols
      ]));
      expect((r as MapParseError).code, MapValidationCode.invalidBounds);
    });

    test('grid dimension bounds: 73 cols / 37 rows rejected, 72x36 accepted',
        () {
      expect(
        (_validate(_gridDocJson(grid: {'cols': 73, 'rows': 3}, zones: []))
                as MapParseError)
            .code,
        MapValidationCode.invalidBounds,
      );
      expect(
        (_validate(_gridDocJson(grid: {'cols': 4, 'rows': 37}, zones: []))
                as MapParseError)
            .code,
        MapValidationCode.invalidBounds,
      );
      expect(
        _validate(_gridDocJson(grid: {'cols': 72, 'rows': 36}, zones: []))
            .isOk,
        isTrue,
      );
    });

    test('grid docs may exceed 500 zones (up to cols×rows)', () {
      // 30×20 grid fully populated: 600 zones — over the old 500 cap.
      final zones = [
        for (var row = 0; row < 20; row++)
          for (var col = 0; col < 30; col++)
            {
              'id': 'c-$col-$row',
              'name': 'Zone ${row * 30 + col + 1}',
              'gridPos': [col, row],
            },
      ];
      final r = _validate(
          _gridDocJson(grid: {'cols': 30, 'rows': 20}, zones: zones));
      expect(r.isOk, isTrue);
    });

    test('a grid doc may not carry more zones than cells', () {
      // 4×3 grid → cap 12; a 13th zone (explicit geometry, no cell) trips it.
      final zones = [
        for (var row = 0; row < 3; row++)
          for (var col = 0; col < 4; col++)
            {
              'id': 'c-$col-$row',
              'name': 'Zone ${row * 4 + col + 1}',
              'gridPos': [col, row],
            },
        {
          'id': 'extra',
          'name': 'Extra',
          'geometry': {
            'kind': 'sphericalCap',
            'center': [0, 0],
            'radiusDeg': 5,
          },
        },
      ];
      final r = _validate(_gridDocJson(zones: zones));
      expect((r as MapParseError).code, MapValidationCode.tooManyZones);
    });

    test('non-grid docs keep the 500-zone cap', () {
      final zones = [
        for (var i = 0; i < 501; i++)
          {
            'id': 'z$i',
            'name': 'z$i',
            'geometry': {
              'kind': 'sphericalCap',
              'center': [0, 0],
              'radiusDeg': 1,
            },
          },
      ];
      final json = _gridDocJson(zones: zones)..remove('grid');
      final r = _validate(json);
      expect((r as MapParseError).code, MapValidationCode.tooManyZones);
    });
  });

  group('implicit cell geometry + analytic picking', () {
    test('gridCellRing densifies the parallels and clamps pole latitudes', () {
      // 4 cols → 90° of longitude per cell → 30 segments per parallel edge.
      final ring = gridCellRing(col: 0, row: 0, cols: 4, rows: 3);
      expect(ring.length, 2 * 31);
      for (final g in ring) {
        expect(g.lat.abs(), lessThanOrEqualTo(kGridPoleClampLat));
      }
      // Row 0 touches the north pole: its top edge is clamped to 89.5.
      expect(ring.map((g) => g.lat).reduce((a, b) => a > b ? a : b),
          kGridPoleClampLat);
    });

    test('the implicit quad contains its own center and not its neighbor\'s',
        () {
      const grid = MapGrid(cols: 4, rows: 3);
      final ring = gridCellRing(col: 2, row: 1, cols: 4, rows: 3);
      expect(
        pointInSphericalPolygon(grid.cellCenter(2, 1), [ring]),
        isTrue,
      );
      expect(
        pointInSphericalPolygon(grid.cellCenter(1, 1), [ring]),
        isFalse,
      );
      expect(
        pointInSphericalPolygon(grid.cellCenter(2, 0), [ring]),
        isFalse,
      );
    });

    test('gridCellAt maps cell centers back to their cells and clamps edges',
        () {
      const grid = MapGrid(cols: 4, rows: 3);
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 4; col++) {
          final cell = gridCellAt(grid.cellCenter(col, row), cols: 4, rows: 3);
          expect((cell.col, cell.row), (col, row),
              reason: 'center of ($col, $row)');
        }
      }
      // Seam / pole extremes clamp instead of overflowing.
      expect(gridCellAt(const GeoPoint(180, 0), cols: 4, rows: 3).col, 3);
      expect(gridCellAt(const GeoPoint(-180, 0), cols: 4, rows: 3).col, 0);
      expect(gridCellAt(const GeoPoint(0, -90), cols: 4, rows: 3).row, 2);
      expect(gridCellAt(const GeoPoint(0, 90), cols: 4, rows: 3).row, 0);
    });
  });

  group('grid render model', () {
    testWidgets('bodies only for overrides; labels skip placeholder names',
        (tester) async {
      final doc = MapDocument.fromJson(_gridDocJson());
      final render = buildSphereRender(doc);

      // One item: the explored cell. Placeholder cells build nothing.
      expect(render.items.length, 1);
      final item = render.items.single;
      expect(item.zoneId, 'c-2-1');
      expect(item.paintBody, isTrue);
      expect(item.rings, isNotEmpty);
      expect(item.label, isNotNull);

      // Every gridPos zone is still addressable (selection highlight/picking).
      expect(render.gridPosById.keys,
          containsAll(<String>['c-0-0', 'c-2-1', 'c-3-2']));

      // The graticule covers all cell boundaries: 4 meridians + 2 parallels.
      expect(render.graticule.length, 4 + 2);
    });

    test('placeholder detection: real names are label-worthy', () {
      MapZone zone(String name, {MapThemeOverride? override}) => MapZone(
            id: 'z',
            name: name,
            geometry: null,
            gridPos: const GridPos(0, 0),
            labelAnchor: null,
            themeOverride: override,
            fields: const {},
          );
      expect(isLabelWorthyGridZone(zone('Zone 907')), isFalse);
      expect(isLabelWorthyGridZone(zone('')), isFalse);
      expect(isLabelWorthyGridZone(zone('Basalt Steppe')), isTrue);
      expect(isLabelWorthyGridZone(zone('Zone of Silence')), isTrue);
      expect(
        isLabelWorthyGridZone(
            zone('Zone 907', override: const MapThemeOverride())),
        isTrue,
      );
    });

    test('FTS rows are built for geometry-less grid zones', () {
      final doc = MapDocument.fromJson(_gridDocJson());
      final rows = buildZoneFtsRows(doc);
      expect(rows.length, 3);
      expect(rows.map((r) => r.name), contains('Basalt Steppe'));
    });
  });

  group('grid viewports', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues(
          <String, Object>{'settings.reduceAnimations': true});
      prefs = await SharedPreferences.getInstance();
    });

    Widget host(Widget child) => ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            favoriteIdsProvider.overrideWith(
              (ref, kind) => Stream.value(const <String>{}),
            ),
            zonePinProvider.overrideWith((ref, key) => Stream.value(null)),
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

    testWidgets('globe: a center tap picks the cell analytically',
        (tester) async {
      final doc = MapDocument.fromJson(_gridDocJson());
      await tester.pumpWidget(host(GlobeViewport(document: doc)));
      await tester.pumpAndSettle();
      final rect = tester.getRect(find.byType(GlobeViewport));

      // Camera centres (lon 0, lat 0) → col ⌊180/90⌋ = 2, row ⌊90/60⌋ = 1:
      // the explored 'Basalt Steppe' cell.
      await tester.tapAt(rect.center);
      await tester.pumpAndSettle();
      expect(find.byType(ZoneSheet), findsOneWidget);
      expect(find.text('Basalt Steppe'), findsWidgets);
    });

    testWidgets('globe: a tap on an empty cell clears the selection',
        (tester) async {
      final doc = MapDocument.fromJson(_gridDocJson());
      await tester.pumpWidget(host(GlobeViewport(document: doc)));
      await tester.pumpAndSettle();
      final rect = tester.getRect(find.byType(GlobeViewport));

      // ~19° west of center is cell (1, 1) — no zone lives there.
      await tester.tapAt(rect.center + const Offset(-60, 0));
      await tester.pumpAndSettle();
      expect(find.byType(ZoneSheet), findsNothing);
    });

    testWidgets('grid view: tapping a cell opens the same ZoneSheet',
        (tester) async {
      final doc = MapDocument.fromJson(_gridDocJson());
      await tester.pumpWidget(host(MapGridView(document: doc)));
      await tester.pumpAndSettle();
      final rect = tester.getRect(find.byType(MapGridView));

      // Canvas 384×256 (4×96, wait rows: 3×64 = 192) fitted into 400×400:
      // fit = min(400/384, 400/192) = 1.0417, centered. Cell (2, 1) center is
      // canvas (240, 96) → screen offset (250, ...) inside the viewport.
      final fit = 400 / (4 * kGridCellWidth);
      final origin = Offset(
        rect.left + (400 - 4 * kGridCellWidth * fit) / 2,
        rect.top + (400 - 3 * kGridCellHeight * fit) / 2,
      );
      final target = origin +
          Offset(2.5 * kGridCellWidth * fit, 1.5 * kGridCellHeight * fit);
      await tester.tapAt(target);
      await tester.pumpAndSettle();
      expect(find.byType(ZoneSheet), findsOneWidget);
      expect(find.text('Basalt Steppe'), findsWidgets);
    });
  });
}
