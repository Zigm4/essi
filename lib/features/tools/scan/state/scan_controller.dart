import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/horizons_client.dart';
import '../data/scan_repository.dart';
import '../domain/scan_models.dart';

@immutable
class ScanState {
  final ScanMode mode;
  final bool isScanning;
  final int progressCount;
  final List<PlanetRow> rows;
  final DateTime? lastScannedAt;

  const ScanState({
    required this.mode,
    required this.isScanning,
    required this.progressCount,
    required this.rows,
    required this.lastScannedAt,
  });

  factory ScanState.initial() {
    return ScanState(
      mode: ScanMode.light,
      isScanning: false,
      progressCount: 0,
      rows: HorizonsClient.planets
          .map((p) => PlanetRow(
                name: p.name,
                emoji: p.emoji,
                status: const PlanetRowPending(),
              ))
          .toList(growable: false),
      lastScannedAt: null,
    );
  }

  ScanState copyWith({
    ScanMode? mode,
    bool? isScanning,
    int? progressCount,
    List<PlanetRow>? rows,
    DateTime? lastScannedAt,
  }) {
    return ScanState(
      mode: mode ?? this.mode,
      isScanning: isScanning ?? this.isScanning,
      progressCount: progressCount ?? this.progressCount,
      rows: rows ?? this.rows,
      lastScannedAt: lastScannedAt ?? this.lastScannedAt,
    );
  }

  bool get canShare {
    if (isScanning) return false;
    return rows.any((r) => r.status is PlanetRowOk);
  }

  bool get allOk => rows.every((r) => r.status is PlanetRowOk);
  bool get hasError => rows.any((r) => r.status is PlanetRowErrored);
}

class ScanController extends StateNotifier<ScanState> {
  ScanController(this._client, this._repo) : super(ScanState.initial());

  final HorizonsClient _client;
  final ScanRepository _repo;

  CancelToken? _cancel;
  int _generation = 0;

  void setMode(ScanMode mode) {
    if (state.isScanning) return;
    state = state.copyWith(mode: mode);
  }

  void cancel() {
    _cancel?.cancel('user cancelled');
    state = state.copyWith(isScanning: false);
  }

  Future<void> startScan() async {
    _cancel?.cancel('restart');
    final myGeneration = ++_generation;
    final cancel = CancelToken();
    _cancel = cancel;

    final activeMode = state.mode;
    state = state.copyWith(
      isScanning: true,
      progressCount: 0,
      rows: HorizonsClient.planets
          .map((p) => PlanetRow(
                name: p.name,
                emoji: p.emoji,
                status: const PlanetRowPending(),
              ))
          .toList(growable: false),
    );

    final total = HorizonsClient.planets.length;
    for (var i = 0; i < total; i++) {
      if (_generation != myGeneration || cancel.isCancelled) {
        break;
      }
      final planet = HorizonsClient.planets[i];
      try {
        final pos = activeMode == ScanMode.light
            ? await _client.fetchLight(planet: planet, cancel: cancel)
            : await _client.fetchFull(planet: planet, cancel: cancel);
        if (_generation != myGeneration) break;
        _updateRow(planet.name, PlanetRowOk(pos));
      } on ScanError catch (e) {
        if (e is ScanCancelledError) break;
        if (_generation != myGeneration) break;
        _updateRow(planet.name, PlanetRowErrored(e));
      } catch (_) {
        if (_generation != myGeneration) break;
        _updateRow(planet.name, const PlanetRowErrored(ScanUnparseableError()));
      }
      if (_generation != myGeneration) break;
      state = state.copyWith(progressCount: i + 1);
      if (i < total - 1) {
        await Future<void>.delayed(HorizonsClient.interRequestDelay);
      }
    }

    if (_generation != myGeneration) return;

    final completed = state.rows
        .where((r) => r.status is PlanetRowOk)
        .map((r) => (r.status as PlanetRowOk).position)
        .toList(growable: false);

    state = state.copyWith(
      isScanning: false,
      lastScannedAt: DateTime.now(),
    );

    if (completed.isNotEmpty) {
      await _repo.save(
        mode: activeMode,
        snapshots: completed,
        hadErrors: state.hasError,
      );
    }
  }

  void _updateRow(String name, PlanetRowStatus status) {
    final updated = state.rows
        .map((r) => r.name == name ? r.copyWith(status: status) : r)
        .toList(growable: false);
    state = state.copyWith(rows: updated);
  }

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }
}

final horizonsClientProvider = Provider<HorizonsClient>((ref) {
  return HorizonsClient();
});

final scanControllerProvider =
    StateNotifierProvider.autoDispose<ScanController, ScanState>((ref) {
  return ScanController(
    ref.watch(horizonsClientProvider),
    ref.watch(scanRepositoryProvider),
  );
});
