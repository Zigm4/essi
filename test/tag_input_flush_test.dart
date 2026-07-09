import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/features/captures/widgets/tag_input_field.dart';

/// F38: typed-but-uncommitted tag text must survive Save. An editor calls
/// [TagInputController.commitPending] at the start of `_save`; this test drives
/// that path and asserts the half-typed token is surfaced via `onChanged`.
void main() {
  Widget host(TagInputController controller, List<String> tags,
      ValueChanged<List<String>> onChanged) {
    return MaterialApp(
      home: Scaffold(
        body: TagInputField(
          controller: controller,
          selectedTags: tags,
          onChanged: onChanged,
          suggestionPool: const [],
        ),
      ),
    );
  }

  testWidgets('commitPending flushes a half-typed tag into onChanged',
      (tester) async {
    final controller = TagInputController();
    var tags = <String>['alpha'];
    List<String>? emitted;

    await tester.pumpWidget(host(controller, tags, (t) {
      emitted = t;
      tags = t;
    }));

    // User types a tag but never presses space/comma/enter to commit it.
    await tester.enterText(find.byType(TextField), 'beta');
    await tester.pump();

    // Nothing committed yet.
    expect(emitted, isNull);

    // Editor flushes the pending token as part of Save.
    controller.commitPending();

    expect(emitted, ['alpha', 'beta']);
  });

  testWidgets('commitPending with empty pending text is a no-op',
      (tester) async {
    final controller = TagInputController();
    List<String>? emitted;

    await tester.pumpWidget(
      host(controller, const ['alpha'], (t) => emitted = t),
    );

    controller.commitPending();

    expect(emitted, isNull);
  });
}
