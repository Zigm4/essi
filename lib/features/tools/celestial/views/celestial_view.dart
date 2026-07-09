import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import '../../../../services/share_card.dart';
import '../domain/celestial_kind.dart';
import '../domain/celestial_models.dart';
import '../state/celestial_controller.dart';
import '../widgets/discoveries_list_share_card.dart';
import 'discoveries_how_it_works.dart';
import 'discovery_detail_sheet.dart';
import 'discovery_history_sheet.dart';

class CelestialView extends ConsumerStatefulWidget {
  const CelestialView({super.key});

  @override
  ConsumerState<CelestialView> createState() => _CelestialViewState();
}

class _CelestialViewState extends ConsumerState<CelestialView> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(celestialControllerProvider);
    final notifier = ref.read(celestialControllerProvider.notifier);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Discoveries', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline, color: AppColors.accentPrimary),
            tooltip: 'How this tool works',
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const DiscoveriesHowItWorksView(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.history, color: AppColors.accentPrimary),
            tooltip: 'Search history',
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => DiscoveryHistorySheet(
                  onReplay: (entry) {
                    Navigator.of(context).pop();
                    final detail = entry.detail;
                    notifier.applyReplay(
                      kind: CelestialKindX.fromId(entry.mode),
                      startDate: detail.startDate,
                      endDate: detail.endDate,
                    );
                  },
                ),
              );
            },
          ),
        ],
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
              const _TransparencyCard(),
              const SizedBox(height: AppSpacing.lg),
              _QueryCard(
                kind: state.kind,
                startDate: state.startDate,
                endDate: state.endDate,
                isSearching: state.isSearching,
                isAsteroid: state.isAsteroid,
                isWideWindow: state.isWideWindow,
                expectedSeconds: state.expectedSeconds,
                onKind: (k) {
                  Haptics.of(ref).selection();
                  notifier.setKind(k);
                },
                onPickStart: () => _pickDate(true, state, notifier),
                onPickEnd: () => _pickDate(false, state, notifier),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: state.isSearching
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
                            child: Text(
                              'Querying SBDB…',
                              style: AppTypography.mono.copyWith(
                                fontSize: 13,
                                color: AppColors.accentSecondary,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: notifier.cancel,
                            icon: const Icon(Icons.stop_circle,
                                color: AppColors.accentDanger, size: 26),
                          ),
                        ],
                      )
                    : NeonButton(
                        title: 'Search',
                        icon: Icons.travel_explore,
                        onPressed: notifier.search,
                      ),
              ),
              if (state.errorMessage != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _ErrorCard(message: state.errorMessage!, isTimeout: state.timedOut),
              ],
              if (state.results != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _ResultsSection(
                  results: state.results!,
                  truncated: state.resultsTruncated,
                  kind: state.kind,
                  startDate: state.startDate,
                  endDate: state.endDate,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickDate(
    bool isStart,
    CelestialState state,
    CelestialController notifier,
  ) async {
    final today = DateTime.now();
    final maxDate = DateTime(today.year, today.month, today.day);
    final initial = isStart ? state.startDate : state.endDate;
    DateTime? picked;
    if (Platform.isIOS) {
      picked = await _showCupertinoDatePicker(
        context: context,
        initial: initial,
        firstDate: DateTime(1800),
        lastDate: maxDate,
      );
    } else {
      picked = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime(1800),
        lastDate: maxDate,
        builder: (context, child) => Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.accentPrimary,
              onPrimary: AppColors.bgDeepest,
              surface: AppColors.bgElevated,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        ),
      );
    }
    if (picked == null) return;
    if (isStart) {
      notifier.setStartDate(picked);
    } else {
      notifier.setEndDate(picked);
    }
  }
}

Future<DateTime?> _showCupertinoDatePicker({
  required BuildContext context,
  required DateTime initial,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  DateTime selected = initial;
  return showCupertinoModalPopup<DateTime>(
    context: context,
    builder: (ctx) => Container(
      height: 280,
      color: AppColors.bgElevated,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            SizedBox(
              height: 44,
              child: Row(
                children: [
                  CupertinoButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('Cancel',
                        style: TextStyle(color: AppColors.textSecondary)),
                  ),
                  const Spacer(),
                  CupertinoButton(
                    onPressed: () => Navigator.of(ctx).pop(selected),
                    child: const Text('Done',
                        style: TextStyle(color: AppColors.accentPrimary)),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.bgDeepest),
            Expanded(
              child: CupertinoTheme(
                data: const CupertinoThemeData(
                  brightness: Brightness.dark,
                  textTheme: CupertinoTextThemeData(
                    dateTimePickerTextStyle: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                    ),
                  ),
                ),
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: initial,
                  minimumDate: firstDate,
                  maximumDate: lastDate,
                  onDateTimeChanged: (d) => selected = d,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _TransparencyCard extends StatelessWidget {
  const _TransparencyCard();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.wifi_tethering,
                color: AppColors.accentWarn,
                size: 18,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Network access required', style: AppTypography.headline),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This tool sends a single GET request to the NASA SBDB Query API. Nothing happens until you tap Search.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            height: 1,
            color: AppColors.borderSubtle.withValues(alpha: 0.4),
          ),
          const SizedBox(height: AppSpacing.sm),
          const _Bullet(
              label: 'Endpoint:', value: 'ssd-api.jpl.nasa.gov/sbdb_query.api'),
          const _Bullet(
              label: 'Sent:',
              value: 'Object kind (comet or asteroid) + a date range'),
          const _Bullet(
              label: 'Received:',
              value: 'JSON list of bodies matching the filter'),
          const _Bullet(
              label: 'Locally:',
              value:
                  'Status icon + optional client-side date filter for pre-1900 dates'),
          const _Bullet(
              label: 'To NASA:', value: 'Your IP address (like any web request)'),
          const _Bullet(
              label: 'Stored:',
              value:
                  'Nothing sent to a server (searches are saved locally on your device)'),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.accentPrimary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QueryCard extends StatelessWidget {
  const _QueryCard({
    required this.kind,
    required this.startDate,
    required this.endDate,
    required this.isSearching,
    required this.isAsteroid,
    required this.isWideWindow,
    required this.expectedSeconds,
    required this.onKind,
    required this.onPickStart,
    required this.onPickEnd,
  });

  final CelestialKind kind;
  final DateTime startDate;
  final DateTime endDate;
  final bool isSearching;
  final bool isAsteroid;
  final bool isWideWindow;
  final ({int lo, int hi}) expectedSeconds;
  final ValueChanged<CelestialKind> onKind;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;

  @override
  Widget build(BuildContext context) {
    final iso = DateFormat('yyyy-MM-dd');
    final days = endDate.difference(startDate).inDays;
    final dayWord = days == 1 ? 'day' : 'days';
    final isHistorical = startDate.year < 1900;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Query', icon: Icons.event_note),
          const SizedBox(height: AppSpacing.md),
          _KindPills(current: kind, disabled: isSearching, onChange: onKind),
          const SizedBox(height: AppSpacing.md),
          _DateChipRow(
            label: 'Start',
            date: startDate,
            disabled: isSearching,
            onPick: onPickStart,
          ),
          const SizedBox(height: AppSpacing.sm),
          _DateChipRow(
            label: 'End',
            date: endDate,
            disabled: isSearching,
            onPick: onPickEnd,
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: AppColors.accentSecondary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(
                color: AppColors.accentSecondary.withValues(alpha: 0.35),
                width: 0.7,
              ),
            ),
            child: Text(
              '${iso.format(startDate)} → ${iso.format(endDate)} · $days $dayWord (UTC)',
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.accentSecondary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _LatencyHint(
            isAsteroid: isAsteroid,
            isWideWindow: isWideWindow,
            expectedSeconds: expectedSeconds,
          ),
          if (isHistorical) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline,
                    color: AppColors.accentWarn, size: 14),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Pre-1900 start dates trigger a broader query and a local filter. May take significantly longer.',
                    style: AppTypography.caption,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _KindPills extends StatelessWidget {
  const _KindPills({
    required this.current,
    required this.disabled,
    required this.onChange,
  });

  final CelestialKind current;
  final bool disabled;
  final ValueChanged<CelestialKind> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        children: [
          for (final k in CelestialKind.values)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: disabled ? null : () => onChange(k),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: current == k
                        ? AppColors.accentPrimary.withValues(alpha: 0.18)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: current == k
                          ? AppColors.accentPrimary.withValues(alpha: 0.7)
                          : Colors.transparent,
                      width: 1,
                    ),
                    boxShadow: current == k
                        ? [
                            BoxShadow(
                              color: AppColors.accentPrimary
                                  .withValues(alpha: 0.20),
                              blurRadius: 12,
                            ),
                          ]
                        : const [],
                  ),
                  child: Center(
                    child: Text(
                      k.displayName,
                      style: AppTypography.mono.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                        color: current == k
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
    );
  }
}

class _DateChipRow extends StatelessWidget {
  const _DateChipRow({
    required this.label,
    required this.date,
    required this.disabled,
    required this.onPick,
  });

  final String label;
  final DateTime date;
  final bool disabled;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM yyyy');
    return Row(
      children: [
        SizedBox(
          width: 56,
          child: Text(
            label,
            style: AppTypography.caption.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
        ),
        const Spacer(),
        Opacity(
          opacity: disabled ? 0.5 : 1,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: disabled ? null : onPick,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: AppColors.accentPrimary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: AppColors.accentPrimary.withValues(alpha: 0.55),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    fmt.format(date),
                    style: AppTypography.body.copyWith(
                      color: AppColors.accentPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(Icons.expand_more,
                      color: AppColors.accentPrimary, size: 16),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _LatencyHint extends StatelessWidget {
  const _LatencyHint({
    required this.isAsteroid,
    required this.isWideWindow,
    required this.expectedSeconds,
  });

  final bool isAsteroid;
  final bool isWideWindow;
  final ({int lo, int hi}) expectedSeconds;

  @override
  Widget build(BuildContext context) {
    final tint = isAsteroid ? AppColors.accentWarn : AppColors.accentPrimary;
    final iconWarn = isAsteroid || isWideWindow;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          iconWarn ? Icons.timer_outlined : Icons.schedule,
          size: 14,
          color: tint,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Estimated time: ${expectedSeconds.lo} to ${expectedSeconds.hi} seconds',
                style: AppTypography.mono.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: tint,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                isAsteroid
                    ? "Asteroid queries are slower than comet queries (the SBDB indexes millions of bodies). Timeout is set to 90 seconds."
                    : isWideWindow
                        ? 'Wide windows return more rows. Timeout is 30 seconds; if you hit it, narrow the range.'
                        : 'Comet queries return quickly. Timeout is 30 seconds.',
                style: AppTypography.caption,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.isTimeout});
  final String message;
  final bool isTimeout;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isTimeout ? Icons.timer_off_outlined : Icons.warning_amber,
                color: AppColors.accentDanger,
                size: 18,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(message, style: AppTypography.body),
              ),
            ],
          ),
          if (isTimeout) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Try narrowing the window, or shifting the dates so the query lands inside SBDB\'s indexed range.',
              style: AppTypography.caption,
            ),
          ],
        ],
      ),
    );
  }
}

class _ResultsSection extends ConsumerWidget {
  const _ResultsSection({
    required this.results,
    required this.truncated,
    required this.kind,
    required this.startDate,
    required this.endDate,
  });
  final List<DiscoveredObject> results;
  final bool truncated;
  final CelestialKind kind;
  final DateTime startDate;
  final DateTime endDate;

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    final ok = await ShareCardCapture.share(
      context: context,
      card: DiscoveriesListShareCard(
        results: results,
        kind: kind,
        startDate: startDate,
        endDate: endDate,
      ),
      fileName:
          'underdeck-discoveries-${DateTime.now().millisecondsSinceEpoch}.png',
      text: 'Underdeck discoveries',
      sharePositionOrigin: ShareCardCapture.originRectFor(context),
    );
    if (!ok && context.mounted) {
      ShareCardCapture.showShareFailure(context);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (results.isEmpty) {
      final label = kind == CelestialKind.comet ? 'comets' : 'asteroids';
      return GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.search_off,
                    color: AppColors.accentWarn, size: 18),
                const SizedBox(width: AppSpacing.sm),
                Text('No matches', style: AppTypography.headline),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'No $label were discovered between ${DateFormat('yyyy-MM-dd').format(startDate)} and ${DateFormat('yyyy-MM-dd').format(endDate)}. Try a wider window or shift the dates.',
              style: AppTypography.caption,
            ),
          ],
        ),
      );
    }
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: SectionHeader(
                  title:
                      'Results · ${results.length}',
                  icon: Icons.list,
                ),
              ),
              IconButton(
                onPressed: () => _share(context, ref),
                icon: const Icon(Icons.ios_share,
                    color: AppColors.accentPrimary, size: 18),
                tooltip: 'Share results',
              ),
            ],
          ),
          if (truncated) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: AppColors.accentWarn.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(AppRadius.sm),
                border: Border.all(
                  color: AppColors.accentWarn.withValues(alpha: 0.5),
                  width: 0.7,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warning_amber,
                      color: AppColors.accentWarn, size: 16),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Results truncated — SBDB capped this reply at its row '
                      'limit, so more matches almost certainly exist. Narrow '
                      'the date range for a complete list.',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.accentWarn,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          for (final obj in results) ...[
            _DiscoveryCard(obj: obj),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
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
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => DiscoveryDetailSheet(object: obj),
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
