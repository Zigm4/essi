import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/services/notifications.dart';

/// P2: TrainAlertState is persisted to shared_preferences so the armed zone
/// survives an app restart (previously it lived only in memory, so the UI
/// forgot the armed zone while the OS kept firing scheduled alerts). These
/// tests drive the load side directly — construction restores a fresh armed
/// state, drops stale state, and starts empty with no stored value.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restores a future armed state on construction', () async {
    final arrival = DateTime.now().add(const Duration(minutes: 5));
    SharedPreferences.setMockInitialValues({
      'trainAlert.armed':
          '{"armedZone":3,"arrival":${arrival.millisecondsSinceEpoch}}',
    });
    final prefs = await SharedPreferences.getInstance();
    final controller = TrainAlertController(prefs);

    expect(controller.state.armedZone, 3);
    expect(controller.state.arrival!.millisecondsSinceEpoch,
        arrival.millisecondsSinceEpoch);
    controller.dispose();
  });

  test('drops stale armed state whose arrival is in the past', () async {
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

  test('starts empty when nothing is stored', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final controller = TrainAlertController(prefs);

    expect(controller.state.armedZone, isNull);
    expect(controller.state.arrival, isNull);
    controller.dispose();
  });

  test('tolerates malformed stored JSON and starts empty', () async {
    SharedPreferences.setMockInitialValues({
      'trainAlert.armed': 'not json at all',
    });
    final prefs = await SharedPreferences.getInstance();
    final controller = TrainAlertController(prefs);

    expect(controller.state, TrainAlertState.empty);
    controller.dispose();
  });
}
