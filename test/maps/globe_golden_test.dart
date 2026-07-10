import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_models.dart';
import 'package:underdeck_app/features/knowledge/maps/render/globe_painter.dart';
import 'package:underdeck_app/features/knowledge/maps/render/sphere_math.dart';

/// Loads the bundled seed globe straight from disk (the real demo sphere).
MapDocument _seedKeth9() {
  final json = jsonDecode(
    File('assets/maps_seed/keth-9.map.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  return MapDocument.fromJson(json);
}

void main() {
  testWidgets('GlobePainter golden (seed sphere, fixed orientation)',
      (tester) async {
    final doc = _seedKeth9();
    final render = buildSphereRender(doc);

    // Fixed orientation = the map's own initial camera, so the golden is stable.
    final o = doc.sphere!.initialOrientation;
    final orientation = ValueNotifier<GlobeOrientation>(
      GlobeOrientation.fromLatLon(lat: o.lat, lon: o.lon),
    );
    final zoom = ValueNotifier<double>(1.0);
    final selected = ValueNotifier<String?>('s-rustwind'); // show a highlight

    const size = Size(420, 420);
    const key = ValueKey('globe-canvas');

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: RepaintBoundary(
            key: key,
            child: SizedBox.fromSize(
              size: size,
              child: ColoredBox(
                color: render.theme.background,
                child: CustomPaint(
                  size: size,
                  painter: GlobePainter(
                    render: render,
                    orientation: orientation,
                    zoom: zoom,
                    selected: selected,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await expectLater(
      find.byKey(key),
      matchesGoldenFile('goldens/globe_keth9.png'),
    );

    orientation.dispose();
    zoom.dispose();
    selected.dispose();
  });
}
