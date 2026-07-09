import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../celestial/domain/celestial_kind.dart';
import '../data/tracker_client.dart';
import '../data/tracker_repository.dart';
import '../domain/tracker_models.dart';

@immutable
sealed class TrackerPhase {
  const TrackerPhase();
}

class TrackerIdle extends TrackerPhase {
  const TrackerIdle();
}

class TrackerLoading extends TrackerPhase {
  const TrackerLoading();
}

class TrackerReady extends TrackerPhase {
  final TrackerResult result;
  const TrackerReady(this.result);
}

class TrackerErrored extends TrackerPhase {
  final TrackerError error;
  const TrackerErrored(this.error);
}

@immutable
class TrackerState {
  final String query;
  final CelestialKind kind;
  final TrackerPhase phase;
  final String? lockedMpcID;

  const TrackerState({
    required this.query,
    required this.kind,
    required this.phase,
    this.lockedMpcID,
  });

  factory TrackerState.initial() => const TrackerState(
    query: '',
    kind: CelestialKind.asteroid,
    phase: TrackerIdle(),
  );

  TrackerState copyWith({
    String? query,
    CelestialKind? kind,
    TrackerPhase? phase,
    String? lockedMpcID,
    bool clearLock = false,
  }) {
    return TrackerState(
      query: query ?? this.query,
      kind: kind ?? this.kind,
      phase: phase ?? this.phase,
      lockedMpcID: clearLock ? null : (lockedMpcID ?? this.lockedMpcID),
    );
  }
}

class TrackerController extends StateNotifier<TrackerState> {
  TrackerController(this._ref, this._client, this._repo)
      : super(TrackerState.initial());

  final Ref _ref;
  final TrackerClient _client;
  final TrackerRepository _repo;
  CancelToken? _cancel;
  int _generation = 0;

  /// Resolves the catalog lazily without the provider *watching* it, so the
  /// controller is never rebuilt from initial() when the asset resolves (F7).
  TrackerCatalog get _catalog =>
      _ref.read(trackerCatalogProvider).valueOrNull ?? const TrackerCatalog([]);

  void setQuery(String value) {
    final exact = _catalog.matchExact(value);
    if (exact != null) {
      state = state.copyWith(
        query: value,
        kind: exact.kind,
        lockedMpcID: exact.identifier,
      );
    } else {
      state = state.copyWith(query: value, clearLock: true);
    }
  }

  void setKind(CelestialKind kind) {
    state = state.copyWith(kind: kind);
  }

  void prefill(TrackTarget t) {
    state = state.copyWith(
      query: t.name,
      kind: t.kind,
      lockedMpcID: t.mpcID,
    );
  }

  Future<void> track() async {
    _cancel?.cancel();
    final myGeneration = ++_generation;
    final cancel = CancelToken();
    _cancel = cancel;
    state = state.copyWith(phase: const TrackerLoading());

    final target = TrackTarget(
      name: state.query,
      kind: state.kind,
      mpcID: state.lockedMpcID,
    );
    try {
      // Await the catalog rather than snapshotting it at construction, so an
      // auto-track fired before the asset resolves still gets a full catalog.
      final catalog = await _ref.read(trackerCatalogProvider.future);
      if (!mounted || _generation != myGeneration) return;
      final result = await _client.track(
        target: target,
        catalog: catalog,
        cancel: cancel,
      );
      if (!mounted || _generation != myGeneration) return;
      await _repo.save(result);
      if (!mounted || _generation != myGeneration) return;
      state = state.copyWith(phase: TrackerReady(result));
    } on TrackerError catch (e) {
      if (!mounted || _generation != myGeneration) return;
      if (e is TrackerCancelledError) {
        state = state.copyWith(phase: const TrackerIdle());
      } else {
        state = state.copyWith(phase: TrackerErrored(e));
      }
    } catch (_) {
      if (!mounted || _generation != myGeneration) return;
      state = state.copyWith(
        phase: const TrackerErrored(TrackerUnparseableError()),
      );
    }
  }

  void cancel() {
    _cancel?.cancel();
    // Bump generation so a superseded track() tail can't clobber this idle state.
    _generation++;
    if (!mounted) return;
    state = state.copyWith(phase: const TrackerIdle());
  }

  @override
  void dispose() {
    _generation++;
    _cancel?.cancel();
    super.dispose();
  }
}

final trackerControllerProvider = StateNotifierProvider.autoDispose<
    TrackerController, TrackerState>((ref) {
  // Intentionally does NOT watch trackerCatalogProvider: doing so would rebuild
  // the whole StateNotifier from initial() when the asset resolves, wiping any
  // in-flight track()/prefill (e.g. the Discoveries→Tracker auto-track). The
  // controller resolves the catalog lazily via ref.read instead (F7).
  return TrackerController(
    ref,
    ref.watch(trackerClientProvider),
    ref.watch(trackerRepositoryProvider),
  );
});
