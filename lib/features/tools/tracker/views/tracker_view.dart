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
import '../../celestial/domain/celestial_kind.dart';
import '../domain/tracker_models.dart';
import '../state/tracker_controller.dart';
import '../widgets/tracker_share_card.dart';
import 'tracker_history_sheet.dart';
import 'tracker_how_it_works.dart';

class TrackerView extends ConsumerStatefulWidget {
  const TrackerView({super.key, this.prefill});

  final TrackTarget? prefill;

  @override
  ConsumerState<TrackerView> createState() => _TrackerViewState();
}

class _TrackerViewState extends ConsumerState<TrackerView> {
  late final TextEditingController _query;
  bool _autoFired = false;

  @override
  void initState() {
    super.initState();
    _query = TextEditingController(text: widget.prefill?.name ?? '');
    if (widget.prefill != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(trackerControllerProvider.notifier).prefill(widget.prefill!);
        if (widget.prefill!.mpcID != null && !_autoFired) {
          _autoFired = true;
          ref.read(trackerControllerProvider.notifier).track();
        }
      });
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(trackerControllerProvider);
    final notifier = ref.read(trackerControllerProvider.notifier);
    final catalog =
        ref.watch(trackerCatalogProvider).valueOrNull ?? const TrackerCatalog([]);
    final suggestions = catalog
        .suggestions(state.query, limit: 8, kind: state.kind)
        .where((e) => e.name != state.query)
        .toList();
    final isLoading = state.phase is TrackerLoading;
    final canTrack = state.query.trim().isNotEmpty && !isLoading;

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Tracker', style: AppTypography.headline),
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
                builder: (_) => const TrackerHowItWorksView(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.history, color: AppColors.accentPrimary),
            tooltip: 'Tracker history',
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => TrackerHistorySheet(
                  onPick: (target) {
                    Navigator.of(context).pop();
                    _query.text = target.name;
                    notifier.prefill(target);
                    notifier.track();
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
              const TransmissionHeader(label: 'ESSI · real-time object tracking'),
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
                      'This tool sends 1 to 4 GET requests to public NASA APIs (JPL Horizons + SBDB). Nothing happens until you tap Track.',
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
                      title: 'Target',
                      icon: Icons.center_focus_strong,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _query,
                      autocorrect: false,
                      enableSuggestions: false,
                      enabled: !isLoading,
                      decoration: InputDecoration(
                        hintText: 'Object name (e.g. Ceres, C/2025 N1)',
                        hintStyle: AppTypography.body.copyWith(
                          color: AppColors.textDim,
                        ),
                        filled: true,
                        fillColor: AppColors.bgGlass,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide: BorderSide(color: AppColors.borderSubtle),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide: BorderSide(color: AppColors.borderSubtle),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          borderSide: BorderSide(color: AppColors.borderGlow),
                        ),
                      ),
                      style: AppTypography.body,
                      onChanged: (v) => notifier.setQuery(v),
                    ),
                    if (suggestions.isNotEmpty &&
                        state.lockedMpcID == null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final s in suggestions)
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () {
                                Haptics.of(ref).selection();
                                _query.text = s.name;
                                notifier.setQuery(s.name);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: AppColors.accentPrimary
                                        .withValues(alpha: 0.5),
                                    width: 0.7,
                                  ),
                                ),
                                child: Text(
                                  '${s.kind.emoji} ${s.name}',
                                  style: AppTypography.mono.copyWith(
                                    fontSize: 11,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    _KindPicker(
                      current: state.kind,
                      disabled: isLoading || state.lockedMpcID != null,
                      onChange: (k) => notifier.setKind(k),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: isLoading
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
                            child: Text('Tracking…',
                                style: AppTypography.mono.copyWith(
                                  fontSize: 13,
                                  color: AppColors.accentSecondary,
                                )),
                          ),
                          IconButton(
                            onPressed: notifier.cancel,
                            icon: const Icon(Icons.stop_circle,
                                color: AppColors.accentDanger, size: 26),
                          ),
                        ],
                      )
                    : NeonButton(
                        title: 'Track',
                        icon: Icons.gps_fixed,
                        enabled: canTrack,
                        onPressed: notifier.track,
                      ),
              ),
              if (state.phase is TrackerErrored) ...[
                const SizedBox(height: AppSpacing.lg),
                GlassCard(
                  child: Row(
                    children: [
                      const Icon(Icons.warning,
                          color: AppColors.accentDanger),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          (state.phase as TrackerErrored).error.message,
                          style: AppTypography.body,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (state.phase is TrackerReady) ...[
                const SizedBox(height: AppSpacing.lg),
                _ResultCard(result: (state.phase as TrackerReady).result),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _KindPicker extends StatelessWidget {
  const _KindPicker({
    required this.current,
    required this.disabled,
    required this.onChange,
  });

  final CelestialKind current;
  final bool disabled;
  final ValueChanged<CelestialKind> onChange;

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
            for (final k in CelestialKind.values)
              Expanded(
                child: GestureDetector(
                  onTap: disabled ? null : () => onChange(k),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: current == k
                          ? AppColors.accentPrimary.withValues(alpha: 0.16)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadius.sm - 2),
                      border: Border.all(
                        color: current == k
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
      ),
    );
  }
}

class _ResultCard extends ConsumerWidget {
  const _ResultCard({required this.result});
  final TrackerResult result;

  String _fmt(double v, int digits) => v.toStringAsFixed(digits);

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    await ShareCardCapture.share(
      context: context,
      card: TrackerShareCard(result: result),
      fileName:
          'underdeck-track-${DateTime.now().millisecondsSinceEpoch}.png',
      text: 'Underdeck tracker',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: SectionHeader(title: 'Position', icon: Icons.public),
              ),
              IconButton(
                onPressed: () => _share(context, ref),
                icon: const Icon(Icons.ios_share,
                    color: AppColors.accentPrimary, size: 18),
                tooltip: 'Share track',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text(result.kind.emoji,
                  style: const TextStyle(fontSize: 22)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(result.displayName, style: AppTypography.headline),
                    const SizedBox(height: 2),
                    Text(
                      'MPC ${result.mpcID} · ${DateFormat('d MMM yyyy').format(result.timestamp.toLocal())}',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle),
          const SizedBox(height: AppSpacing.md),
          _InfoRow(
            label: 'Sector',
            value: '${result.sector}',
            valueColor: AppColors.accentPrimary,
            valueSize: 22,
          ),
          _InfoRow(
            label: 'Distance',
            value: '${_fmt(result.slRounded, 3)} SL',
            valueColor: AppColors.accentSecondary,
          ),
          if (result.hasFloorWarning)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Navigation flooring → ${result.slFloor} SL',
                style: AppTypography.caption.copyWith(
                  color: AppColors.accentWarn,
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          _InfoRow(
            label: 'AU distance',
            value: _fmt(result.distanceAU, 3),
          ),
          _InfoRow(label: 'X (AU)', value: _fmt(result.xAU, 3)),
          _InfoRow(label: 'Y (AU)', value: _fmt(result.yAU, 3)),
          _InfoRow(label: 'Z (AU)', value: _fmt(result.zAU, 3)),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.valueColor = AppColors.textPrimary,
    this.valueSize = 14,
  });
  final String label;
  final String value;
  final Color valueColor;
  final double valueSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppTypography.caption)),
          Text(
            value,
            style: AppTypography.mono.copyWith(
              fontSize: valueSize,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
