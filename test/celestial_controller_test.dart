import 'dart:async';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:underdeck_app/data/database/app_database.dart';
import 'package:underdeck_app/features/tools/celestial/data/celestial_client.dart';
import 'package:underdeck_app/features/tools/celestial/data/celestial_repository.dart';
import 'package:underdeck_app/features/tools/celestial/domain/celestial_kind.dart';
import 'package:underdeck_app/features/tools/celestial/domain/celestial_models.dart';
import 'package:underdeck_app/features/tools/celestial/state/celestial_controller.dart';
import 'package:underdeck_app/services/app_settings.dart';

/// A CelestialClient whose `search` is driven by hand-completed futures, so we
/// can interleave two in-flight searches and assert the F37 superseded-cancel
/// guard.
class _FakeClient extends CelestialClient {
  _FakeClient() : super();

  final List<CancelToken> tokens = [];
  final List<Completer<DiscoverySearchResult>> completers = [];

  @override
  Future<DiscoverySearchResult> search({
    required DateTime start,
    required DateTime end,
    required CelestialKind kind,
    required CancelToken cancel,
  }) {
    tokens.add(cancel);
    final c = Completer<DiscoverySearchResult>();
    completers.add(c);
    return c.future;
  }
}

DiscoveredObject _obj(String pdes) => DiscoveredObject(
      designation: pdes,
      fullName: pdes,
      isHazardous: false,
      kind: CelestialKind.comet,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late CelestialRepository repo;
  late _FakeClient client;
  late ProviderContainer container;
  late CelestialController controller;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repo = CelestialRepository(db);
    client = _FakeClient();
    container = ProviderContainer(overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      celestialClientProvider.overrideWithValue(client),
      celestialRepositoryProvider.overrideWithValue(repo),
    ]);
    controller = container.read(celestialControllerProvider.notifier);
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  test('a successful search stores results, truncation, and saves history',
      () async {
    final f = controller.search();
    expect(controller.state.isSearching, isTrue);

    client.completers.single
        .complete(DiscoverySearchResult(objects: [_obj('1P')], truncated: true));
    await f;

    expect(controller.state.isSearching, isFalse);
    expect(controller.state.results, hasLength(1));
    expect(controller.state.resultsTruncated, isTrue);
    expect(controller.state.errorMessage, isNull);

    // The search was persisted to history.
    final history = await repo.watchAll().first;
    expect(history, hasLength(1));
  });

  test('an offline error maps to a message + timedOut and clears results',
      () async {
    final f = controller.search();
    client.completers.single.completeError(const CelestialOfflineError());
    await f;

    expect(controller.state.isSearching, isFalse);
    expect(controller.state.results, isNull);
    expect(controller.state.errorMessage,
        const CelestialOfflineError().message);
    expect(controller.state.timedOut, isTrue);
  });

  test('a superseded search cancellation does not clobber the newer search '
      '(F37)', () async {
    // First search suspends on the fake client.
    final f1 = controller.search();
    await Future<void>.value();
    // Second search supersedes it: cancels the first token, keeps loading.
    final f2 = controller.search();
    await Future<void>.value();

    expect(client.tokens[0].isCancelled, isTrue);

    // The first (now-superseded) search resolves as cancelled — it must NOT
    // touch state, because _cancel now points at the second search.
    client.completers[0].completeError(const CelestialCancelledError());
    await f1;
    expect(controller.state.isSearching, isTrue);
    expect(controller.state.results, isNull);

    // The current search then succeeds and wins.
    client.completers[1]
        .complete(DiscoverySearchResult(objects: [_obj('2P')]));
    await f2;
    expect(controller.state.isSearching, isFalse);
    expect(controller.state.results, hasLength(1));
  });

  test('date setters clamp an inverted range', () {
    final s = controller.state.startDate;
    final e = controller.state.endDate;
    expect(e.isAfter(s), isTrue);

    // Pushing start past end drags end forward.
    final afterEnd = e.add(const Duration(days: 5));
    controller.setStartDate(afterEnd);
    expect(controller.state.startDate, afterEnd);
    expect(controller.state.endDate, afterEnd);

    // Pulling end before start drags start back.
    final beforeStart = afterEnd.subtract(const Duration(days: 3));
    controller.setEndDate(beforeStart);
    expect(controller.state.endDate, beforeStart);
    expect(controller.state.startDate, beforeStart);
  });

  test('cancel keeps previously loaded results', () async {
    // Load an initial result set.
    final f = controller.search();
    client.completers.single
        .complete(DiscoverySearchResult(objects: [_obj('1P')]));
    await f;
    expect(controller.state.results, hasLength(1));

    // Start a second search then cancel it: prior results survive.
    controller.search();
    await Future<void>.value();
    controller.cancel();
    expect(controller.state.isSearching, isFalse);
    expect(controller.state.results, hasLength(1));
  });
}
