import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/neon_button.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../tracker/domain/tracker_models.dart';
import '../data/celestial_client.dart';
import '../data/celestial_repository.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';

class CelestialView extends ConsumerStatefulWidget {
  const CelestialView({super.key});

  @override
  ConsumerState<CelestialView> createState() => _CelestialViewState();
}

class _CelestialViewState extends ConsumerState<CelestialView> {
  late DateTime _startDate;
  late DateTime _endDate;
  CelestialKind _kind = CelestialKind.comet;
  bool _isSearching = false;
  CancelToken? _cancel;
  List<DiscoveredObject>? _results;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    final yesterday = DateTime(today.year, today.month, today.day)
        .subtract(const Duration(days: 1));
    _endDate = yesterday;
    _startDate = yesterday.subtract(const Duration(days: 10));
  }

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  Future<void> _search() async {
    _cancel?.cancel();
    final cancel = CancelToken();
    _cancel = cancel;
    setState(() {
      _isSearching = true;
      _errorMessage = null;
    });
    try {
      final results = await ref.read(celestialClientProvider).search(
        start: _startDate,
        end: _endDate,
        kind: _kind,
        cancel: cancel,
      );
      await ref.read(celestialRepositoryProvider).save(
        kind: _kind,
        startDate: _startDate,
        endDate: _endDate,
        results: results,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _isSearching = false;
      });
    } on CelestialError catch (e) {
      if (!mounted) return;
      setState(() {
        _isSearching = false;
        _errorMessage = e.message;
        if (e is! CelestialCancelledError) Haptics.of(ref).warning();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSearching = false;
        _errorMessage = 'Unexpected error.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Discoveries', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: PageScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const TransmissionHeader(label: 'ESSI · deep space discovery'),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.wifi_tethering,
                            color: AppColors.accentWarn, size: 18),
                        const SizedBox(width: AppSpacing.sm),
                        Text('Network access required',
                            style: AppTypography.headline),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'This tool sends a single GET request to the NASA SBDB Query API. Nothing happens until you tap Search.',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Query',
                      icon: Icons.calendar_today,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: AppColors.bgGlass,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(color: AppColors.borderSubtle),
                      ),
                      child: Row(
                        children: [
                          for (final k in CelestialKind.values)
                            Expanded(
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: _isSearching
                                    ? null
                                    : () {
                                        Haptics.of(ref).selection();
                                        setState(() => _kind = k);
                                      },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: _kind == k
                                        ? AppColors.accentPrimary
                                            .withValues(alpha: 0.16)
                                        : Colors.transparent,
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.sm - 2),
                                    border: Border.all(
                                      color: _kind == k
                                          ? AppColors.accentPrimary
                                          : Colors.transparent,
                                    ),
                                  ),
                                  child: Center(
                                    child: Text(
                                      k.displayName,
                                      style: AppTypography.mono.copyWith(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: _kind == k
                                            ? AppColors.accentPrimary
                                            : AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _DateRow(
                      label: 'Start',
                      date: _startDate,
                      onPick: () => _pickDate(true),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _DateRow(
                      label: 'End',
                      date: _endDate,
                      onPick: () => _pickDate(false),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Window: ${_endDate.difference(_startDate).inDays} day${_endDate.difference(_startDate).inDays == 1 ? '' : 's'}',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: _isSearching
                    ? Row(
                        children: [
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(
                                AppColors.accentPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text('Searching…',
                                style: AppTypography.mono.copyWith(
                                  fontSize: 13,
                                  color: AppColors.accentSecondary,
                                )),
                          ),
                          IconButton(
                            onPressed: () {
                              _cancel?.cancel();
                              setState(() => _isSearching = false);
                            },
                            icon: const Icon(Icons.stop_circle,
                                color: AppColors.accentDanger, size: 26),
                          ),
                        ],
                      )
                    : NeonButton(
                        title: 'Search',
                        icon: Icons.travel_explore,
                        onPressed: _search,
                      ),
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: AppSpacing.lg),
                GlassCard(
                  child: Row(
                    children: [
                      const Icon(Icons.warning,
                          color: AppColors.accentDanger),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(_errorMessage!, style: AppTypography.body),
                      ),
                    ],
                  ),
                ),
              ],
              if (_results != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _ResultsSection(results: _results!),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickDate(bool isStart) async {
    final today = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: DateTime(1800),
      lastDate: DateTime(today.year, today.month, today.day),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_startDate.isAfter(_endDate)) _endDate = _startDate;
      } else {
        _endDate = picked;
        if (_endDate.isBefore(_startDate)) _startDate = _endDate;
      }
    });
  }
}

class _DateRow extends StatelessWidget {
  const _DateRow({
    required this.label,
    required this.date,
    required this.onPick,
  });
  final String label;
  final DateTime date;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onPick,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 12,
        ),
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Row(
          children: [
            SizedBox(width: 60, child: Text(label, style: AppTypography.caption)),
            Expanded(
              child: Text(
                DateFormat('d MMM yyyy').format(date),
                style: AppTypography.body,
              ),
            ),
            const Icon(Icons.calendar_today,
                color: AppColors.textSecondary, size: 16),
          ],
        ),
      ),
    );
  }
}

class _ResultsSection extends StatelessWidget {
  const _ResultsSection({required this.results});
  final List<DiscoveredObject> results;

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) {
      return GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.search, color: AppColors.accentWarn),
                const SizedBox(width: AppSpacing.sm),
                Text('No matches', style: AppTypography.headline),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'No bodies discovered in this date range. Try a wider window.',
              style: AppTypography.caption,
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: '${results.length} result${results.length == 1 ? '' : 's'}',
          icon: Icons.list,
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final obj in results) ...[
          _DiscoveryCard(obj: obj),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _DiscoveryCard extends ConsumerWidget {
  const _DiscoveryCard({required this.obj});
  final DiscoveredObject obj;

  Color _statusColor() {
    switch (obj.status) {
      case DiscoveryStatus.ok:
        return AppColors.accentSuccess;
      case DiscoveryStatus.caution:
        return AppColors.accentWarn;
      case DiscoveryStatus.danger:
        return AppColors.accentDanger;
      case DiscoveryStatus.unknown:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Haptics.of(ref).tap();
        context.push(
          '/tools/tracker',
          extra: TrackTarget(
            name: obj.displayName,
            kind: obj.kind,
            mpcID: obj.designation,
          ),
        );
      },
      child: GlassCard(
        child: Row(
          children: [
            Container(
              width: 8,
              height: 50,
              decoration: BoxDecoration(
                color: _statusColor(),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(obj.displayName, style: AppTypography.body),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(obj.kind.emoji,
                          style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 4),
                      Text(
                        obj.firstObs ?? '?',
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (obj.diameterMeters != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          '${obj.diameterMeters!.toStringAsFixed(1)} m',
                          style: AppTypography.mono.copyWith(
                            fontSize: 11,
                            color: AppColors.textDim,
                          ),
                        ),
                      ],
                      if (obj.isHazardous) ...[
                        const SizedBox(width: 6),
                        Text(
                          'PHA',
                          style: AppTypography.mono.copyWith(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentDanger,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.gps_fixed,
                color: AppColors.accentPrimary, size: 18),
          ],
        ),
      ),
    );
  }
}
