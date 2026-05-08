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
import '../data/horizons_client.dart';
import '../domain/scan_models.dart';
import '../state/scan_controller.dart';
import '../widgets/planet_result_row.dart';
import 'scan_history_sheet.dart';

class SystemScanView extends ConsumerWidget {
  const SystemScanView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(scanControllerProvider);
    final controller = ref.read(scanControllerProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('System Scan', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            color: AppColors.accentPrimary,
            tooltip: 'Scan history',
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const ScanHistorySheet(),
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
              const TransmissionHeader(label: 'ESSI · deep space monitoring'),
              const SizedBox(height: AppSpacing.lg),
              const _TransparencyCard(),
              const SizedBox(height: AppSpacing.lg),
              _ModeCard(state: state, onChange: controller.setMode),
              const SizedBox(height: AppSpacing.lg),
              _ActionCard(
                state: state,
                onScan: controller.startScan,
                onCancel: controller.cancel,
              ),
              const SizedBox(height: AppSpacing.lg),
              _ResultsCard(state: state),
            ],
          ),
        ),
      ),
    );
  }
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
            "This is the only feature in Underdeck that talks to a network. Calls are made one at a time with a small gap, to stay under JPL Horizons' rate limit.",
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            height: 1,
            color: AppColors.borderSubtle.withValues(alpha: 0.4),
          ),
          const SizedBox(height: AppSpacing.sm),
          const _Bullet(label: 'Endpoint:', value: 'ssd.jpl.nasa.gov/api/horizons.api'),
          const _Bullet(label: 'Sent:', value: 'Planet codes (199-999) and the current UTC timestamp'),
          const _Bullet(label: 'Received:', value: 'Public ephemeris text (X, Y, Z heliocentric vectors)'),
          const _Bullet(label: 'Locally:', value: 'Sector (1-12) and distance in SL'),
          const _Bullet(label: 'To NASA:', value: 'Your IP address (like any web request)'),
          const _Bullet(label: 'Stored:', value: 'Nothing'),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This feature is opt-in: nothing happens until you tap Scan now.',
            style: AppTypography.caption,
          ),
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

class _ModeCard extends ConsumerWidget {
  const _ModeCard({required this.state, required this.onChange});
  final ScanState state;
  final ValueChanged<ScanMode> onChange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Mode', icon: Icons.tune),
          const SizedBox(height: AppSpacing.md),
          _ModeSegmented(
            current: state.mode,
            disabled: state.isScanning,
            onChange: (m) {
              Haptics.of(ref).selection();
              onChange(m);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Text(state.mode.summary, style: AppTypography.body),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(
                Icons.schedule,
                size: 12,
                color: AppColors.accentWarn,
              ),
              const SizedBox(width: 6),
              Text(
                'Estimated time: ${state.mode.latencyHint}',
                style: AppTypography.mono.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.accentWarn,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModeSegmented extends StatelessWidget {
  const _ModeSegmented({
    required this.current,
    required this.disabled,
    required this.onChange,
  });

  final ScanMode current;
  final bool disabled;
  final ValueChanged<ScanMode> onChange;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        padding: const EdgeInsets.all(2),
        child: Row(
          children: [
            for (final m in ScanMode.values)
              Expanded(
                child: GestureDetector(
                  onTap: disabled ? null : () => onChange(m),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: current == m
                          ? AppColors.accentPrimary.withValues(alpha: 0.16)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadius.sm - 2),
                      border: Border.all(
                        color: current == m
                            ? AppColors.accentPrimary
                            : Colors.transparent,
                        width: 1,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        m.label,
                        style: AppTypography.mono.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: current == m
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
    );
  }
}

class _ActionCard extends ConsumerWidget {
  const _ActionCard({
    required this.state,
    required this.onScan,
    required this.onCancel,
  });

  final ScanState state;
  final Future<void> Function() onScan;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      child: Column(
        children: [
          if (state.isScanning)
            Row(
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(AppColors.accentPrimary),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Scanning… ${state.progressCount}/${HorizonsClient.planets.length}',
                    style: AppTypography.mono.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.accentSecondary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () {
                    Haptics.of(ref).warning();
                    onCancel();
                  },
                  icon: const Icon(
                    Icons.stop_circle,
                    color: AppColors.accentDanger,
                    size: 26,
                  ),
                ),
              ],
            )
          else
            NeonButton(
              title: 'Scan now',
              icon: Icons.center_focus_strong,
              onPressed: onScan,
            ),
          if (state.lastScannedAt != null && !state.isScanning) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Last scan: ${DateFormat('HH:mm:ss').format(state.lastScannedAt!.toLocal())} local',
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ResultsCard extends StatelessWidget {
  const _ResultsCard({required this.state});
  final ScanState state;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Solar system snapshot',
            icon: Icons.public,
          ),
          const SizedBox(height: AppSpacing.md),
          for (var i = 0; i < state.rows.length; i++) ...[
            PlanetResultRow(row: state.rows[i]),
            if (i < state.rows.length - 1)
              Container(
                height: 1,
                margin: const EdgeInsets.symmetric(vertical: 2),
                color: AppColors.borderSubtle.withValues(alpha: 0.3),
              ),
          ],
        ],
      ),
    );
  }
}
