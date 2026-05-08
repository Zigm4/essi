import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
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

  Future<void> _toggleAlert(int zone, MarsExpressSchedule schedule) async {
    final alert = ref.read(trainAlertControllerProvider);
    final notifier = ref.read(trainAlertControllerProvider.notifier);
    if (alert.armedZone == zone) {
      await notifier.cancel();
      Haptics.of(ref).warning();
      return;
    }
    final dates = MarsExpressService.alertDates(
      zone: zone,
      stops: schedule.stops,
      now: _now,
    );
    if (dates.isEmpty) return;
    final ok = await notifier.arm(zone: zone, alertDates: dates);
    if (ok) {
      Haptics.of(ref).success();
    } else {
      Haptics.of(ref).error();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Notifications permission denied.'),
          ),
        );
      }
    }
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
              'Error loading schedule: $e',
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
                          'Tap a row to arm or cancel alerts (T-2, T-1, arrival)',
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
                            onArm: () =>
                                _toggleAlert(entries[i].zone, schedule),
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
    required this.onArm,
  });
  final ScheduleEntry entry;
  final bool isCurrent;
  final bool isArmed;
  final VoidCallback onArm;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onArm,
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
              Icon(
                isArmed
                    ? Icons.notifications_active
                    : Icons.notifications_outlined,
                color: isArmed
                    ? AppColors.accentWarn
                    : AppColors.textDim,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
