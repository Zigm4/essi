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
  TrackerController(this._client, this._repo, this._catalog)
      : super(TrackerState.initial());

  final TrackerClient _client;
  final TrackerRepository _repo;
  final TrackerCatalog _catalog;
  CancelToken? _cancel;

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
    final cancel = CancelToken();
    _cancel = cancel;
    state = state.copyWith(phase: const TrackerLoading());

    final target = TrackTarget(
      name: state.query,
      kind: state.kind,
      mpcID: state.lockedMpcID,
    );
    try {
      final result = await _client.track(
        target: target,
        catalog: _catalog,
        cancel: cancel,
      );
      await _repo.save(result);
      state = state.copyWith(phase: TrackerReady(result));
    } on TrackerError catch (e) {
      if (e is TrackerCancelledError) {
        state = state.copyWith(phase: const TrackerIdle());
      } else {
        state = state.copyWith(phase: TrackerErrored(e));
      }
    } catch (_) {
      state = state.copyWith(
        phase: const TrackerErrored(TrackerUnparseableError()),
      );
    }
  }

  void cancel() {
    _cancel?.cancel();
    state = state.copyWith(phase: const TrackerIdle());
  }

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }
}

final trackerControllerProvider = StateNotifierProvider.autoDispose<
    TrackerController, TrackerState>((ref) {
  final catalogAsync = ref.watch(trackerCatalogProvider);
  final catalog = catalogAsync.valueOrNull ?? const TrackerCatalog([]);
  return TrackerController(
    ref.watch(trackerClientProvider),
    ref.watch(trackerRepositoryProvider),
    catalog,
  );
});
