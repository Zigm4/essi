import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/tools/scan/data/horizons_client.dart';

/// R12 — golden/fixture tests for [HorizonsParser]: the shape of a real JPL
/// Horizons VECTORS text response (header + `$$SOE` … `A.D.` … `TDB` …
/// `X = .. Y = .. Z = ..` … `$$EOE`), the km→sector/SL math, and the error
/// paths that must surface a [HorizonsFormatException] rather than collapsing
/// into an empty "no data" result.

/// A nominal two-position ephemeris. The middle block has a malformed vector
/// line (`X = badvalue …`) that must be skipped, leaving exactly two positions.
/// Every block also carries a `VX=/VY=/VZ=` velocity line that must NOT be
/// mistaken for the position line.
const _nominal = '''
*******************************************************************************
 JPL/HORIZONS                  Ceres (A801 AA)             2026-Jul-10 00:00:00
 Revised: April 12, 2021               Ceres                              1;
*******************************************************************************
\$\$SOE
2459580.500000000 = A.D. 2022-Jan-01 00:00:00.0000 TDB
 X = 5.000000000000000E+06 Y = 0.000000000000000E+00 Z = 1.000000000000000E+05
 VX= 1.000000000000000E+00 VY= 2.000000000000000E+00 VZ= 3.000000000000000E+00
 LT= 1.000000000000000E+00 RG= 5.000000000000000E+06 RR= 0.000000000000000E+00
2459581.500000000 = A.D. 2022-Jan-02 00:00:00.0000 TDB
 X = badvalue Y = 0.0 Z = 0.0
 VX= 1.000000000000000E+00 VY= 2.000000000000000E+00 VZ= 3.000000000000000E+00
2459582.500000000 = A.D. 2022-Jan-03 00:00:00.0000 TDB
 X = 0.000000000000000E+00 Y = 5.000000000000000E+06 Z = 0.000000000000000E+00
 VX= 1.000000000000000E+00 VY= 2.000000000000000E+00 VZ= 3.000000000000000E+00
\$\$EOE
*******************************************************************************
''';

/// An in-band "API SERVER BUSY" notice — a 200 body that is not an ephemeris
/// table at all (no `$$SOE`).
const _serverBusy = '''
*******************************************************************************
 JPL/HORIZONS
 API SERVER BUSY - please try again later. No ephemeris was generated.
*******************************************************************************
''';

void main() {
  group('HorizonsParser.allPositions (nominal fixture)', () {
    test('parses positions between \$\$SOE/\$\$EOE and skips a malformed line', () {
      final positions = HorizonsParser.allPositions(_nominal);
      // Jan-01 (valid) + Jan-03 (valid); Jan-02 has a malformed X value.
      expect(positions, hasLength(2));

      final first = positions[0];
      expect(first.date, DateTime.utc(2022, 1, 1, 0, 0, 0, 0));
      expect(first.x, 5000000.0);
      expect(first.y, 0.0);
      expect(first.z, 100000.0);

      final second = positions[1];
      expect(second.date, DateTime.utc(2022, 1, 3, 0, 0, 0, 0));
      expect(second.x, 0.0);
      expect(second.y, 5000000.0);
      expect(second.z, 0.0);
    });

    test('firstPosition returns the first parsed vector', () {
      final first = HorizonsParser.firstPosition(_nominal);
      expect(first, isNotNull);
      expect(first!.x, 5000000.0);
      expect(first.date, DateTime.utc(2022, 1, 1));
    });

    test('_parseDate handles fractional seconds via the date column', () {
      // 12:30:45.5 TDB -> milliseconds rounded to 500.
      const withFraction = '''
\$\$SOE
2459580.500000000 = A.D. 2022-Mar-04 12:30:45.5000 TDB
 X = 1.0E+00 Y = 2.0E+00 Z = 3.0E+00
\$\$EOE
''';
      final positions = HorizonsParser.allPositions(withFraction);
      expect(positions, hasLength(1));
      expect(positions.single.date,
          DateTime.utc(2022, 3, 4, 12, 30, 45, 500));
    });
  });

  group('HorizonsParser.metrics (km -> sector / SL)', () {
    // sector = atan2 bucketed into 1..12 (bucket 1 == +X axis, CCW).
    test('atan2 bucketing lands in 1..12 across the quadrants', () {
      expect(HorizonsParser.metrics(x: 1, y: 0).sector, 1);
      expect(HorizonsParser.metrics(x: 1, y: 1).sector, 2); // pi/4 -> floor 1.5
      expect(HorizonsParser.metrics(x: 0, y: 1).sector, 4); // pi/2
      expect(HorizonsParser.metrics(x: -1, y: 0).sector, 7); // pi
      expect(HorizonsParser.metrics(x: 0, y: -1).sector, 10); // 3pi/2
      expect(HorizonsParser.metrics(x: 1, y: -0.0001).sector, 12); // just below +X
    });

    test('every angle maps into the inclusive 1..12 range', () {
      for (var deg = 0; deg < 360; deg += 7) {
        final rad = deg * math.pi / 180.0;
        final m = HorizonsParser.metrics(
          x: 1000000.0 * math.cos(rad),
          y: 1000000.0 * math.sin(rad),
        );
        expect(m.sector, inInclusiveRange(1, 12), reason: 'deg=$deg');
      }
    });

    test('distanceSL floors miles / 3,000,000', () {
      // 5e6 km -> 3,106,855 mi -> SL 1.
      expect(HorizonsParser.metrics(x: 5000000, y: 0).distanceSL, 1);
      // 1e7 km -> 6,213,710 mi -> SL 2.
      expect(HorizonsParser.metrics(x: 10000000, y: 0).distanceSL, 2);
      // Tiny distance -> SL 0.
      expect(HorizonsParser.metrics(x: 1, y: 0).distanceSL, 0);
    });
  });

  group('HorizonsParser error paths', () {
    test('missing \$\$SOE throws HorizonsFormatException (not empty->NoData)', () {
      expect(
        () => HorizonsParser.allPositions(_serverBusy),
        throwsA(isA<HorizonsFormatException>()),
      );
    });

    test('an "API SERVER BUSY" notice surfaces its text in the preview', () {
      try {
        HorizonsParser.allPositions(_serverBusy);
        fail('expected HorizonsFormatException');
      } on HorizonsFormatException catch (e) {
        expect(e.preview, contains('API SERVER BUSY'));
      }
    });

    test('preview is collapsed and truncated to 200 chars for a long body', () {
      final long = 'ERROR ${'x' * 500}'; // no \$\$SOE anywhere
      try {
        HorizonsParser.allPositions(long);
        fail('expected HorizonsFormatException');
      } on HorizonsFormatException catch (e) {
        expect(e.preview.length, 200);
      }
    });

    test('a table with \$\$SOE but no valid vectors returns empty (-> NoData)', () {
      const emptyTable = '''
\$\$SOE
(no ephemeris rows here)
\$\$EOE
''';
      expect(HorizonsParser.allPositions(emptyTable), isEmpty);
    });
  });
}
