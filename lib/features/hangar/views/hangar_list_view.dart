import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/banner_page.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/terminal_notes.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../../captures/widgets/tag_chip.dart';
import '../data/hangar_repository.dart';
import '../domain/hangar_models.dart';
import 'ship_editor_view.dart';

class HangarListView extends ConsumerWidget {
  const HangarListView({super.key});

  static const _categoryOrder = [
    ('landcraft', 'Landcraft', Icons.directions_car),
    ('watercraft', 'Watercraft', Icons.sailing),
    ('spacecraft', 'Spacecraft', Icons.rocket_launch),
    ('other', 'Other', Icons.help_outline),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shipsAsync = ref.watch(shipsStreamProvider);
    final catalogsAsync = ref.watch(hangarCatalogsProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: AppBackground(
        child: BannerPage(
          bannerLabel: 'ESSI · Fleet Registry',
          bannerActions: [
            _BannerIconButton(
              icon: Icons.add,
              onTap: () {
                Haptics.of(ref).tap();
                showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  // F14: disable swipe-to-dismiss so the editor's unsaved-
                  // changes PopScope guard isn't bypassed.
                  enableDrag: false,
                  backgroundColor: Colors.transparent,
                  builder: (_) => const ShipEditorView(),
                );
              },
            ),
          ],
          builder: (context, ctrl) => shipsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Text(
                friendlyError(e, fallback: "Couldn't load your hangar."),
                style: AppTypography.body.copyWith(color: AppColors.accentDanger),
              ),
            ),
            data: (ships) {
              final cat = catalogsAsync.valueOrNull;
              final grouped = <String, List<ShipModel>>{};
              for (final s in ships) {
                final key =
                    cat?.shipForKey(s.modelKey)?.category ?? 'other';
                grouped.putIfAbsent(key, () => []).add(s);
              }
              // R8: virtualize the ship list. Each category becomes a header
              // sliver + a lazily-built SliverList over its ships, so only the
              // visible cards are constructed. Banner/empty-state/notes are
              // preserved.
              final slivers = <Widget>[
                if (ships.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xxl,
                      ),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(
                              Icons.archive_outlined,
                              size: 48,
                              color: AppColors.accentPrimary
                                  .withValues(alpha: 0.4),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text('Hangar empty',
                                style: AppTypography.headline),
                            const SizedBox(height: 4),
                            Text(
                              'Tap + to register your first ship.',
                              style: AppTypography.caption,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  for (final c in _categoryOrder)
                    if ((grouped[c.$1] ?? const []).isNotEmpty) ...[
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: AppSpacing.sm,
                          ),
                          child: Row(
                            children: [
                              Icon(c.$3,
                                  color: AppColors.accentPrimary, size: 18),
                              const SizedBox(width: AppSpacing.sm),
                              Text(
                                c.$2.toUpperCase(),
                                style: AppTypography.mono.copyWith(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 2,
                                  color: AppColors.accentPrimary,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '· ${grouped[c.$1]!.length}',
                                style: AppTypography.mono.copyWith(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      SliverList.builder(
                        itemCount: grouped[c.$1]!.length,
                        itemBuilder: (context, i) => Padding(
                          padding:
                              const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _ShipCard(
                            ship: grouped[c.$1]![i],
                            catalogs: cat,
                          ),
                        ),
                      ),
                      const SliverToBoxAdapter(
                        child: SizedBox(height: AppSpacing.md),
                      ),
                    ],
                const SliverToBoxAdapter(
                  child: SizedBox(height: AppSpacing.lg),
                ),
                const SliverToBoxAdapter(child: _HangarNotesCard()),
              ];
              return PageScrollView.slivers(
                controller: ctrl,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.xxl,
                ),
                slivers: slivers,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BannerIconButton extends StatelessWidget {
  const _BannerIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Icon(icon, color: AppColors.accentPrimary, size: 18),
      ),
    );
  }
}

class _ShipCard extends ConsumerWidget {
  const _ShipCard({required this.ship, required this.catalogs});
  final ShipModel ship;
  final HangarCatalogs? catalogs;

  Color _hullColor(int current, int max) {
    final ratio = max == 0 ? 0.0 : current / max;
    if (ratio >= 0.75) return AppColors.accentSuccess;
    if (ratio >= 0.40) return AppColors.accentWarn;
    return AppColors.accentDanger;
  }

  /// Clamp-and-persist a hull delta from the card stepper. Clamps to
  /// [0, catalog hullMax] when the max is known; lower bound 0 otherwise.
  /// Optimistic UI comes free via [shipsStreamProvider] re-emitting.
  Future<void> _adjustHull(WidgetRef ref, int delta) async {
    final current = ship.hull;
    if (current == null) return;
    final max = catalogs?.shipForKey(ship.modelKey)?.hullMax;
    var next = current + delta;
    if (next < 0) next = 0;
    if (max != null && next > max) next = max;
    if (next == current) return;
    Haptics.of(ref).selection();
    await ref.read(hangarRepositoryProvider).updateHull(ship.id, next);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entry = catalogs?.shipForKey(ship.modelKey);
    final modelDisplay = (ship.customModelLabel?.isNotEmpty ?? false)
        ? ship.customModelLabel
        : entry?.displayName;
    final loc = catalogs == null ? null : ship.locationDisplay(catalogs!);
    final assignments = ship.assignedRoles;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Haptics.of(ref).tap();
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          // F14: disable swipe-to-dismiss so the editor's unsaved-changes
          // PopScope guard isn't bypassed.
          enableDrag: false,
          backgroundColor: Colors.transparent,
          builder: (_) => ShipEditorView(ship: ship),
        );
      },
      onLongPress: () => _confirmDelete(context, ref),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ship.name.isEmpty ? '(unnamed)' : ship.name,
                        style: AppTypography.headline,
                      ),
                      if (modelDisplay != null) ...[
                        const SizedBox(height: 2),
                        Text(modelDisplay, style: AppTypography.caption),
                      ],
                    ],
                  ),
                ),
                Row(
                  children: [
                    Icon(
                      ship.registered
                          ? Icons.verified
                          : Icons.warning_amber_rounded,
                      color: ship.registered
                          ? AppColors.accentSuccess
                          : AppColors.accentWarn,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      ship.registered ? 'Registered' : 'Unregistered',
                      style: AppTypography.caption.copyWith(
                        color: ship.registered
                            ? AppColors.accentSuccess
                            : AppColors.accentWarn,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            if (loc != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  const Icon(Icons.place,
                      color: AppColors.accentPrimary, size: 16),
                  const SizedBox(width: 4),
                  Expanded(child: Text(loc, style: AppTypography.body)),
                ],
              ),
            ],
            if (ship.hull != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.shield,
                      color: AppColors.accentPrimary, size: 16),
                  const SizedBox(width: 4),
                  Text('Hull ', style: AppTypography.caption),
                  if (entry?.hullMax != null)
                    Text(
                      '${ship.hull} / ${entry!.hullMax}',
                      style: AppTypography.mono.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _hullColor(ship.hull!, entry.hullMax!),
                      ),
                    )
                  else
                    Text(
                      '${ship.hull}',
                      style: AppTypography.mono.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accentSecondary,
                      ),
                    ),
                  const Spacer(),
                  _HullStepButton(
                    icon: Icons.remove,
                    enabled: ship.hull! > 0,
                    onTap: () => _adjustHull(ref, -1),
                  ),
                  const SizedBox(width: 6),
                  _HullStepButton(
                    icon: Icons.add,
                    enabled: entry?.hullMax == null || ship.hull! < entry!.hullMax!,
                    onTap: () => _adjustHull(ref, 1),
                  ),
                ],
              ),
            ],
            if (assignments.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              for (final a in assignments)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 1),
                  child: Row(
                    children: [
                      const SizedBox(width: 4),
                      Icon(_iconFor(a.key),
                          color: AppColors.accentSecondary, size: 12),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 80,
                        child: Text(
                          a.key.displayName,
                          style: AppTypography.caption,
                        ),
                      ),
                      Text(
                        a.value,
                        style: AppTypography.mono.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            if (ship.tags.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final t in ship.tags) ...[
                      TagChip(label: t.displayName),
                      const SizedBox(width: 4),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData _iconFor(ShipRight role) {
    switch (role) {
      case ShipRight.pilot:
        return Icons.flight;
      case ShipRight.gunner:
        return Icons.center_focus_strong;
      case ShipRight.cartographer:
        return Icons.map;
      case ShipRight.prospector:
        return Icons.search;
      case ShipRight.signaller:
        return Icons.wifi_tethering;
      case ShipRight.technician:
        return Icons.build;
      case ShipRight.sentry:
        return Icons.shield;
      case ShipRight.fabricator:
        return Icons.handyman;
      case ShipRight.medic:
        return Icons.local_hospital;
      case ShipRight.quartermaster:
        return Icons.inventory_2;
      case ShipRight.chef:
        return Icons.restaurant;
      case ShipRight.alchemist:
        return Icons.science;
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Delete ship?', style: AppTypography.headline),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Delete',
              style: AppTypography.body.copyWith(
                color: AppColors.accentDanger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirm == true) {
      Haptics.of(ref).warning();
      await ref.read(hangarRepositoryProvider).delete(ship.id);
    }
  }
}

/// Compact square +/- control for the ship-card hull stepper. Disabled state
/// dims the glyph and swallows taps so clamping reads clearly.
class _HullStepButton extends StatelessWidget {
  const _HullStepButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color =
        enabled ? AppColors.accentPrimary : AppColors.textDim;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled ? onTap : null,
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(
            color: enabled
                ? AppColors.accentPrimary.withValues(alpha: 0.4)
                : AppColors.borderSubtle,
          ),
        ),
        child: Icon(icon, color: color, size: 16),
      ),
    );
  }
}

class _HangarNotesCard extends StatelessWidget {
  const _HangarNotesCard();

  @override
  Widget build(BuildContext context) {
    return const TerminalNotes(
      title: 'hangar.notes',
      lines: [
        'To locate a ship, type its entry command in #verified-perk-room and match the APM shown to a known place.',
        'A ship can be recalled at any time, but at a heavy stamina cost.',
        'To register a ship, just try to board it once. Spacecraft spawn at Mars space station, the Rat Raft at Rankle River; other vessels vary.',
      ],
    );
  }
}
