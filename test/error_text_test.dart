import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:underdeck_app/core/error_text.dart';

void main() {
  final req = RequestOptions(path: '/x');

  group('friendlyError', () {
    test('maps connection/timeout DioExceptions to a signal message', () {
      for (final type in [
        DioExceptionType.connectionError,
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ]) {
        expect(
          friendlyError(DioException(requestOptions: req, type: type)),
          'No network connection. Check your signal and try again.',
        );
      }
    });

    test('maps bad-response/unknown DioExceptions to a reach-server message', () {
      for (final type in [
        DioExceptionType.badResponse,
        DioExceptionType.badCertificate,
        DioExceptionType.unknown,
      ]) {
        expect(
          friendlyError(DioException(requestOptions: req, type: type)),
          "Couldn't reach the server. Please try again.",
        );
      }
    });

    test('maps a cancelled request to a cancel message', () {
      expect(
        friendlyError(
          DioException(requestOptions: req, type: DioExceptionType.cancel),
        ),
        'Request cancelled.',
      );
    });

    test('reuses a FormatException curated message', () {
      expect(
        friendlyError(const FormatException('That file is not a valid backup.')),
        'That file is not a valid backup.',
      );
    });

    test('falls back when a FormatException has no message', () {
      expect(
        friendlyError(const FormatException(), fallback: 'Import failed.'),
        'Import failed.',
      );
    });

    test('never leaks raw exception text for unknown errors', () {
      final msg = friendlyError(
        StateError('SqliteException(1): no such table users'),
        fallback: "Couldn't load your notes.",
      );
      expect(msg, "Couldn't load your notes.");
      expect(msg, isNot(contains('Sqlite')));
    });

    test('uses the default fallback when none is provided', () {
      expect(
        friendlyError(Exception('boom')),
        'Something went wrong. Please try again.',
      );
    });
  });
}
