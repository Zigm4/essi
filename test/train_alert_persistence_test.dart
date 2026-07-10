import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/services/notifications.dart';

/// Train alerts are persisted to shared_preferences so armed zones survive an
/// app restart (previously they lived only in memory, so the UI forgot the
/// armed zone while the OS kept firing scheduled alerts). P3 extends this to a
/// multi-zone JSON list with a repeat flag, and migrates the old single-zone
/// shape. These tests drive the load side directly.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('multi-zone format', () {
    test('restores a list of armed zones', () async {
      final a = DateTime.now().add(const Duration(minutes: 5));
      final b = DateTime.now().add(const Duration(minutes: 40));
      SharedPreferences.setMockInitialValues({
        'trainAlert.zones': jsonEncode([
          {
            'zone': 259,
            'slot': 0,
            'repeat': false,
            'lastArrival': a.millisecondsSinceEpoch,
          },
          {
            'zone': 283,
            'slot': 1,
            'repeat': true,
            'lastArrival': b.millisecondsSinceEpoch,
          },
        ]),
      });
      final prefs = await SharedPreferences.getInstance();
      final controller = TrainAlertController(prefs);

      expect(controller.state.zones, hasLength(2));
      expect(controller.state.isArmed(259), isTrue);
      expect(controller.state.isArmed(283), isTrue);
      expect(controller.state.entryFor(283)!.repeat, isTrue);
      expect(controller.state.entryFor(283)!.slot, 1);
      controller.dispose();
    });

    test('drops expired one-shot zones but keeps repeating ones', () async {
      final past = DateTime.now().subtract(const Duration(minutes: 5));
      SharedPreferences.setMockInitialValues({
        'trainAlert.zones': jsonEncode([
          {
            'zone': 259,
            'slot': 0,
            'repeat': false,
            'lastArrival': past.millisecondsSinceEpoch,
          },
          {
            'zone': 283,
            'slot': 1,
            'repeat': true,
            'lastArrival': past.millisecondsSinceEpoch,
          },
        ]),
      });
      final prefs = await SharedPreferences.getInstance();
      final controller = TrainAlertController(prefs);

      // One-shot dropped, repeating kept (refresh() will top it up).
      expect(controller.state.isArmed(259), isFalse);
      expect(controller.state.isArmed(283), isTrue);
      controller.dispose();
    });

    test('tolerates malformed stored JSON and starts empty', () async {
      SharedPreferences.setMockInitialValues({
        'trainAlert.zones': 'not json at all',
      });
      final prefs = await SharedPreferences.getInstance();
      final controller = TrainAlertController(prefs);

      expect(controller.state, TrainAlertState.empty);
      controller.dispose();
    });
  });

  group('legacy single-zone migration', () {
    test('migrates a future single-zone armed state', () async {
      final arrival = DateTime.now().add(const Duration(minutes: 5));
      SharedPreferences.setMockInitialValues({
        'trainAlert.armed':
            '{"armedZone":3,"arrival":${arrival.millisecondsSinceEpoch}}',
      });
      final prefs = await SharedPreferences.getInstance();
      final controller = TrainAlertController(prefs);

      final entry = controller.state.entryFor(3);
      expect(entry, isNotNull);
      expect(entry!.slot, 0);
      expect(entry.repeat, isFalse);
      expect(entry.lastArrival.millisecondsSinceEpoch,
          arrival.millisecondsSinceEpoch);
      controller.dispose();
    });

    test('drops stale legacy state whose arrival is in the past', () async {
      final arrival = DateTime.now().subtract(const Duration(minutes: 5));
      SharedPreferences.setMockInitialValues({
        'trainAlert.armed':
            '{"armedZone":7,"arrival":${arrival.millisecondsSinceEpoch}}',
      });
      final prefs = await SharedPreferences.getInstance();
      final controller = TrainAlertController(prefs);

      expect(controller.state, TrainAlertState.empty);
      controller.dispose();
    });
  });

  test('starts empty when nothing is stored', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final controller = TrainAlertController(prefs);

    expect(controller.state.zones, isEmpty);
    controller.dispose();
  });
}
