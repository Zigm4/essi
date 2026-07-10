import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/core/logging.dart';

void main() {
  tearDown(() {
    // Always detach so a failing test can't leak a reporter into others.
    setErrorReporter(null);
  });

  test('no reporter attached by default — logError does not throw', () {
    expect(() => logError('boom'), returnsNormally);
  });

  test('attached reporter receives the error and stack', () {
    Object? seenError;
    StackTrace? seenStack;
    setErrorReporter((error, stack) {
      seenError = error;
      seenStack = stack;
    });

    final stack = StackTrace.current;
    logError('kaboom', stack);

    expect(seenError, 'kaboom');
    expect(seenStack, same(stack));
  });

  test('detaching with null stops delivery', () {
    var calls = 0;
    setErrorReporter((_, _) => calls++);
    logError('one');
    setErrorReporter(null);
    logError('two');

    expect(calls, 1);
  });

  test('a throwing reporter does not propagate out of logError', () {
    setErrorReporter((_, _) => throw StateError('reporter failed'));
    expect(() => logError('safe'), returnsNormally);
  });
}
