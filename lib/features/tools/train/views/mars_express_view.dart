import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/error_text.dart';
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
import '../../../../services/notifications.dart';
import '../domain/mars_express_models.dart';

class MarsExpressView extends ConsumerStatefulWidget {
  const MarsExpressView({super.key});

  @override
  ConsumerState<MarsExpressView> createState() => _MarsExpressViewState();
}

class _MarsExpressViewState extends ConsumerState<MarsExpressView> {
  Timer? _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        setState(() => _now = DateTime.now());
        ref.read(trainAlertControllerProvider.notifier).refresh();
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _openZoneDetail(int zone, MarsExpressSchedule schedule) {
    Haptics.of(ref).tap();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ZoneDetailSheet(zone: zone, schedule: schedule),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheduleAsync = ref.watch(marsExpressScheduleProvider);
    final alert = ref.watch(trainAlertControllerProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Mars Express', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: scheduleAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load the schedule."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (schedule) {
            final minute = _now.minute;
            final currentStop = schedule.currentStop(minute);
            final entries = MarsExpressService.consolidated(
              currentMinute: minute,
              stops: schedule.stops,
            );
            return PageScrollView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                MediaQuery.paddingOf(context).top +
                    kToolbarHeight +
                    AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.xxl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const TransmissionHeader(
                    label: 'ESSI · transit operations',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  GlassCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'LIVE',
                                style: AppTypography.mono.copyWith(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 2,
                                  color: AppColors.accentSuccess,
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (currentStop != null) ...[
                                Text('Zone ${currentStop.zone}',
                                    style: AppTypography.title),
                                Text(currentStop.name ?? 'Transit route',
                                    style: AppTypography.caption),
                              ] else
                                Text('Idle', style: AppTypography.title),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              ':${minute.toString().padLeft(2, '0')}',
                              style: AppTypography.mono.copyWith(
                                fontSize: 30,
                                fontWeight: FontWeight.w900,
                                color: AppColors.accentSecondary,
                              ),
                            ),
                            Text(
                              DateFormat('HH:mm').format(_now),
                              style: AppTypography.caption,
                            ),
                          ],
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
                          title: 'Schedule (next hour)',
                          icon: Icons.schedule,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Tap a row for zone details and to set alerts.',
                          style: AppTypography.caption,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (var i = 0; i < entries.length; i++) ...[
                          _ScheduleRow(
                            entry: entries[i],
                            isCurrent: !entries[i].nextHour &&
                                minute >= entries[i].startMinute &&
                                minute <= entries[i].endMinute,
                            isArmed: alert.armedZone == entries[i].zone,
                            onTap: () =>
                                _openZoneDetail(entries[i].zone, schedule),
                          ),
                          if (i < entries.length - 1)
                            Container(
                              height: 1,
                              margin:
                                  const EdgeInsets.symmetric(vertical: 2),
                              color: AppColors.borderSubtle.withValues(
                                alpha: 0.3,
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                  if (alert.armedZone != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    GlassCard(
                      child: Row(
                        children: [
                          const Icon(Icons.notifications_active,
                              color: AppColors.accentWarn),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Alerts armed for Zone ${alert.armedZone}',
                                  style: AppTypography.body,
                                ),
                                if (alert.arrival != null)
                                  Text(
                                    'Arrival ${DateFormat('HH:mm').format(alert.arrival!)}',
                                    style: AppTypography.caption,
                                  ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () async {
                              await ref
                                  .read(trainAlertControllerProvider.notifier)
                                  .cancel();
                              if (mounted) {
                                Haptics.of(ref).warning();
                              }
                            },
                            icon: const Icon(Icons.cancel,
                                color: AppColors.accentDanger),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({
    required this.entry,
    required this.isCurrent,
    required this.isArmed,
    required this.onTap,
  });
  final ScheduleEntry entry;
  final bool isCurrent;
  final bool isArmed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Opacity(
          opacity: isCurrent ? 1 : 0.85,
          child: Row(
            children: [
              SizedBox(
                width: 70,
                child: Text(
                  entry.rangeText,
                  style: AppTypography.mono.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isCurrent
                        ? AppColors.accentSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Icon(
                entry.name == null ? Icons.swap_horiz : Icons.tram,
                color: entry.name == null
                    ? AppColors.textDim
                    : AppColors.accentPrimary,
                size: 16,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Zone ${entry.zone}', style: AppTypography.body),
                    Text(entry.name ?? 'Transit', style: AppTypography.caption),
                  ],
                ),
              ),
              if (isArmed) ...[
                const Icon(Icons.notifications_active,
                    color: AppColors.accentWarn, size: 16),
                const SizedBox(width: 4),
              ],
              const Icon(Icons.chevron_right,
                  color: AppColors.textDim, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet that mirrors the iOS `ZoneDetailView`. Shows zone identity,
/// minutes-until-next-arrival, and the alert arming control.
class ZoneDetailSheet extends ConsumerStatefulWidget {
  const ZoneDetailSheet({
    super.key,
    required this.zone,
    required this.schedule,
  });

  final int zone;
  final MarsExpressSchedule schedule;

  @override
  ConsumerState<ZoneDetailSheet> createState() => _ZoneDetailSheetState();
}

class _ZoneDetailSheetState extends ConsumerState<ZoneDetailSheet> {
  Timer? _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String? get _zoneName => widget.schedule.nameFor(widget.zone);

  int? get _minutesUntilNext {
    final arrivals = MarsExpressService.nextArrivals(
      zone: widget.zone,
      currentMinute: _now.minute,
      stops: widget.schedule.stops,
    );
    if (arrivals.isEmpty) return null;
    return arrivals.first - _now.minute;
  }

  Future<void> _arm() async {
    final notifier = ref.read(trainAlertControllerProvider.notifier);
    final dates = MarsExpressService.alertDates(
      zone: widget.zone,
      stops: widget.schedule.stops,
      now: _now,
    );
    if (dates.isEmpty) {
      Haptics.of(ref).warning();
      return;
    }
    final ok = await notifier.arm(zone: widget.zone, alertDates: dates);
    if (!mounted) return;
    if (ok) {
      Haptics.of(ref).success();
      Navigator.of(context).pop();
    } else {
      Haptics.of(ref).error();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Notifications permission denied. Enable notifications in system settings to receive alerts.',
          ),
        ),
      );
    }
  }

  Future<void> _cancel() async {
    await ref.read(trainAlertControllerProvider.notifier).cancel();
    if (!mounted) return;
    Haptics.of(ref).warning();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final alert = ref.watch(trainAlertControllerProvider);
    final isArmed = alert.armedZone == widget.zone;
    final minsRaw = _minutesUntilNext;

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, controller) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
          child: Container(
            color: AppColors.bgElevated,
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.textDim,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Zone ${widget.zone}',
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          letterSpacing: 1.6,
                          color: AppColors.accentPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(_zoneName ?? 'Transit route',
                          style: AppTypography.headline),
                      if (minsRaw != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            const Icon(Icons.tram,
                                color: AppColors.accentPrimary),
                            const SizedBox(width: AppSpacing.sm),
                            Text('Next arrival in',
                                style: AppTypography.caption),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              '$minsRaw min',
                              style: AppTypography.mono.copyWith(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accentSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notifications_outlined,
                              color: AppColors.accentPrimary, size: 18),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            isArmed ? 'Alert armed' : 'Local alerts',
                            style: AppTypography.headline,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        "You'll get 3 notifications: 2 min before, 1 min before, and on arrival. Only one zone can be armed at a time.",
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (isArmed)
                        NeonButton(
                          title: 'Cancel alerts',
                          icon: Icons.notifications_off,
                          onPressed: _cancel,
                        )
                      else
                        NeonButton(
                          title: 'Set alert',
                          icon: Icons.notifications_active,
                          onPressed: _arm,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
