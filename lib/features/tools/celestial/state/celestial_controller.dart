import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/haptics.dart';
import '../data/celestial_client.dart';
import '../data/celestial_repository.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

/// Sentinel so [CelestialState.copyWith] can distinguish "leave unchanged" from
/// "set to null" for the nullable [results] / [errorMessage] fields.
const Object _unset = Object();

@immutable
class CelestialState {
  const CelestialState({
    required this.kind,
    required this.startDate,
    required this.endDate,
    this.isSearching = false,
    this.results,
    this.resultsTruncated = false,
    this.errorMessage,
    this.timedOut = false,
  });

  final CelestialKind kind;
  final DateTime startDate;
  final DateTime endDate;
  final bool isSearching;

  /// Null until the first successful search; kept across a subsequent loading
  /// cycle so a cancelled re-search leaves the previous results on screen.
  final List<DiscoveredObject>? results;
  final bool resultsTruncated;
  final String? errorMessage;
  final bool timedOut;

  /// Default window mirrors the old widget: 10 days ending yesterday, comets.
  factory CelestialState.initial() {
    final today = DateTime.now();
    final yesterday = DateTime(today.year, today.month, today.day)
        .subtract(const Duration(days: 1));
    return CelestialState(
      kind: CelestialKind.comet,
      startDate: yesterday.subtract(const Duration(days: 10)),
      endDate: yesterday,
    );
  }

  int get windowDays => endDate.difference(startDate).inDays;
  bool get isAsteroid => kind == CelestialKind.asteroid;

  /// Estimated request duration band, mirroring the iOS app.
  ({int lo, int hi}) get expectedSeconds {
    final w = windowDays;
    if (!isAsteroid && w < 11) return (lo: 1, hi: 4);
    if (!isAsteroid) return (lo: 4, hi: 20);
    if (w < 11) return (lo: 5, hi: 30);
    if (w < 31) return (lo: 20, hi: 60);
    return (lo: 30, hi: 90);
  }

  bool get isWideWindow {
    if (isAsteroid) return windowDays > 10;
    return windowDays > 30;
  }

  CelestialState copyWith({
    CelestialKind? kind,
    DateTime? startDate,
    DateTime? endDate,
    bool? isSearching,
    Object? results = _unset,
    bool? resultsTruncated,
    Object? errorMessage = _unset,
    bool? timedOut,
  }) {
    return CelestialState(
      kind: kind ?? this.kind,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      isSearching: isSearching ?? this.isSearching,
      results: identical(results, _unset)
          ? this.results
          : results as List<DiscoveredObject>?,
      resultsTruncated: resultsTruncated ?? this.resultsTruncated,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
      timedOut: timedOut ?? this.timedOut,
    );
  }
}

/// Owns the Discoveries search: CancelToken lifecycle, the SBDB client call,
/// the history save, error mapping and result haptics (F65). Extracting this
/// out of the 982-line CelestialView makes the flow unit-testable while keeping
/// behavior identical, including the P1/F37 "superseded cancel must not stamp
/// state over a newer search" guard.
class CelestialController extends StateNotifier<CelestialState> {
  CelestialController(this._ref, this._client, this._repo)
      : super(CelestialState.initial());

  final Ref _ref;
  final CelestialClient _client;
  final CelestialRepository _repo;
  CancelToken? _cancel;

  void setKind(CelestialKind kind) {
    state = state.copyWith(kind: kind);
  }

  /// Sets the start date, clamping the end forward if the range inverts.
  void setStartDate(DateTime picked) {
    var end = state.endDate;
    if (picked.isAfter(end)) end = picked;
    state = state.copyWith(startDate: picked, endDate: end);
  }

  /// Sets the end date, clamping the start back if the range inverts.
  void setEndDate(DateTime picked) {
    var start = state.startDate;
    if (picked.isBefore(start)) start = picked;
    state = state.copyWith(startDate: start, endDate: picked);
  }

  /// Applies a history-replay selection (kind + window) in one shot.
  void applyReplay({
    required CelestialKind kind,
    required DateTime startDate,
    required DateTime endDate,
  }) {
    state = state.copyWith(kind: kind, startDate: startDate, endDate: endDate);
  }

  Future<void> search() async {
    _cancel?.cancel();
    final cancel = CancelToken();
    _cancel = cancel;
    final kind = state.kind;
    final start = state.startDate;
    final end = state.endDate;
    state = state.copyWith(
      isSearching: true,
      errorMessage: null,
      timedOut: false,
      resultsTruncated: false,
    );
    try {
      final result = await _client.search(
        start: start,
        end: end,
        kind: kind,
        cancel: cancel,
      );
      final results = result.objects;
      await _repo.save(
        kind: kind,
        startDate: start,
        endDate: end,
        results: results,
      );
      if (!mounted || !identical(cancel, _cancel)) return;
      state = state.copyWith(
        results: results,
        resultsTruncated: result.truncated,
        isSearching: false,
      );
      if (results.isEmpty) {
        Haptics.ofRef(_ref).warning();
      } else {
        Haptics.ofRef(_ref).success();
      }
    } on CelestialError catch (e) {
      // A superseded search's cancellation must not stamp an error over the
      // newer search's state (F37).
      if (!mounted || !identical(cancel, _cancel)) return;
      if (e is CelestialCancelledError) {
        // Preserve prior results; don't surface a cancellation as an error.
        state = state.copyWith(isSearching: false);
        return;
      }
      state = state.copyWith(
        isSearching: false,
        results: null,
        errorMessage: e.message,
        timedOut: e is CelestialOfflineError,
      );
      Haptics.ofRef(_ref).warning();
    } catch (_) {
      if (!mounted || !identical(cancel, _cancel)) return;
      state = state.copyWith(
        isSearching: false,
        results: null,
        errorMessage: 'Unexpected error.',
      );
    }
  }

  /// Stops an in-flight search, keeping any previously loaded results.
  void cancel() {
    _cancel?.cancel();
    if (!mounted) return;
    state = state.copyWith(isSearching: false);
  }

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }
}

final celestialControllerProvider =
    StateNotifierProvider.autoDispose<CelestialController, CelestialState>(
        (ref) {
  return CelestialController(
    ref,
    ref.watch(celestialClientProvider),
    ref.watch(celestialRepositoryProvider),
  );
});
