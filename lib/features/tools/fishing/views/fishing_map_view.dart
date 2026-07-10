import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error_text.dart';
import '../../../../core/internal_link.dart';
import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/neon_button.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../domain/fishing_models.dart';
import '../widgets/fishing_share_card.dart';

class FishingMapView extends ConsumerWidget {
  const FishingMapView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(fishingDataProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Fishing Map', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load the fishing data."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) => PageScrollView(
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
                const SectionHeader(title: 'Map rooms', icon: Icons.map),
                const SizedBox(height: AppSpacing.md),
                for (final room in data.rooms) ...[
                  _RoomCard(room: room),
                  const SizedBox(height: AppSpacing.md),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({required this.room});
  final FishingRoom room;

  @override
  Widget build(BuildContext context) {
    final depth = room.zones.isNotEmpty
        ? FishingDepth.fromName(room.zones.first.depth)
        : null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.push('/tools/fishing/${room.id}'),
      child: GlassCard(
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: (depth?.color ?? AppColors.accentPrimary)
                    .withValues(alpha: 0.35),
                shape: BoxShape.circle,
              ),
              child: Icon(
                room.isSolo ? Icons.place : Icons.grid_view,
                color: AppColors.accentPrimary,
                size: 22,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(room.displayName, style: AppTypography.headline),
                  const SizedBox(height: 2),
                  Text(
                    room.isSolo ? 'Single zone' : '${room.zones.length} zones',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textDim),
          ],
        ),
      ),
    );
  }
}

class FishingRoomView extends ConsumerStatefulWidget {
  const FishingRoomView({super.key, required this.roomId});

  final String roomId;

  @override
  ConsumerState<FishingRoomView> createState() => _FishingRoomViewState();
}

enum _ZoneFilter { all, known, unknown }

class _FishingRoomViewState extends ConsumerState<FishingRoomView> {
  _ZoneFilter _filter = _ZoneFilter.all;
  final Set<FishingDepth> _depthFilters = {};

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(fishingDataProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          dataAsync.valueOrNull?.rooms
                  .where((r) => r.id == widget.roomId)
                  .map((r) => r.displayName)
                  .firstOrNull ??
              '',
          style: AppTypography.headline,
        ),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load the fishing data."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) {
            FishingRoom? room;
            for (final r in data.rooms) {
              if (r.id == widget.roomId) {
                room = r;
                break;
              }
            }
            if (room == null) {
              return Center(
                child: Text('Room not found',
                    style: AppTypography.caption),
              );
            }
            final roomLabel = room.displayName;
            if (room.isSolo) {
              return PageScrollView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  MediaQuery.paddingOf(context).top +
                      kToolbarHeight +
                      AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.xxl,
                ),
                child: _ZoneSummaryCard(
                  zone: room.zones.first,
                  showsZoneNumber: false,
                  roomLabel: roomLabel,
                ),
              );
            }
            final visible = room.zones.where((z) {
              switch (_filter) {
                case _ZoneFilter.all:
                  break;
                case _ZoneFilter.known:
                  if (!z.accessible) return false;
                  if (z.name == 'Unknown') return false;
                  break;
                case _ZoneFilter.unknown:
                  if (!(z.name == 'Unknown' && z.accessible)) return false;
                  break;
              }
              if (_depthFilters.isNotEmpty) {
                final d = FishingDepth.fromName(z.depth);
                if (d == null || !_depthFilters.contains(d)) return false;
              }
              return true;
            }).toList();
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
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: AppColors.bgGlass,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Row(
                      children: [
                        for (final f in _ZoneFilter.values)
                          Expanded(
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => setState(() => _filter = f),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _filter == f
                                      ? AppColors.accentPrimary
                                          .withValues(alpha: 0.16)
                                      : Colors.transparent,
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.sm - 2),
                                  border: Border.all(
                                    color: _filter == f
                                        ? AppColors.accentPrimary
                                        : Colors.transparent,
                                  ),
                                ),
                                child: Center(
                                  child: Text(
                                    f.name[0].toUpperCase() + f.name.substring(1),
                                    style: AppTypography.body.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: _filter == f
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
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    height: 38,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: FishingDepth.values.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(width: AppSpacing.sm),
                      itemBuilder: (_, i) {
                        final d = FishingDepth.values[i];
                        final selected = _depthFilters.contains(d);
                        return Center(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() {
                              if (selected) {
                                _depthFilters.remove(d);
                              } else {
                                _depthFilters.add(d);
                              }
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: selected
                                    ? d.color
                                    : d.color.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: d.color,
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                d.label,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: selected
                                      ? Colors.black
                                      : d.color,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 6,
                      crossAxisSpacing: 4,
                      mainAxisSpacing: 4,
                    ),
                    itemCount: visible.length,
                    itemBuilder: (context, i) {
                      final z = visible[i];
                      return _ZoneCell(
                        zone: z,
                        onTap: () => _showZone(context, z, roomLabel),
                      );
                    },
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _showZone(BuildContext context, FishingZone zone, String roomLabel) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: _ZoneSummaryCard(
          zone: zone,
          showsZoneNumber: true,
          roomLabel: roomLabel,
        ),
      ),
    );
  }
}

class _ZoneCell extends StatelessWidget {
  const _ZoneCell({required this.zone, required this.onTap});
  final FishingZone zone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final depth = FishingDepth.fromName(zone.depth);
    final color = depth?.color ?? AppColors.bgGlass;
    final accessible = zone.accessible;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: accessible
              ? color.withValues(alpha: 0.55)
              : AppColors.bgGlass,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: accessible
                ? color
                : AppColors.borderSubtle,
            width: 1,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          accessible ? '${zone.id}' : '×',
          style: AppTypography.mono.copyWith(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: accessible ? Colors.white : AppColors.textDim,
          ),
        ),
      ),
    );
  }
}

class _ZoneSummaryCard extends ConsumerWidget {
  const _ZoneSummaryCard({
    required this.zone,
    required this.showsZoneNumber,
    required this.roomLabel,
  });
  final FishingZone zone;
  final bool showsZoneNumber;
  final String roomLabel;

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    final ok = await ShareCardCapture.share(
      context: context,
      card: FishingShareCard(zone: zone, roomLabel: roomLabel),
      fileName: 'underdeck-fishing-zone-${zone.id}.png',
      text: 'Underdeck fishing zone',
      sharePositionOrigin: ShareCardCapture.originRectFor(context),
    );
    if (!ok && context.mounted) {
      ShareCardCapture.showShareFailure(context);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final depth = FishingDepth.fromName(zone.depth);
    return GlassCard(
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
                    if (showsZoneNumber)
                      Text('Zone ${zone.id}', style: AppTypography.caption),
                    Text(zone.name, style: AppTypography.title),
                  ],
                ),
              ),
              FavoriteButton(
                kind: FavoriteKind.fishingZone,
                id: zone.id.toString(),
                tooltip: 'Star zone',
              ),
              IconButton(
                onPressed: () => _share(context, ref),
                icon: const Icon(Icons.ios_share,
                    color: AppColors.accentPrimary, size: 18),
                tooltip: 'Share zone',
                visualDensity: VisualDensity.compact,
              ),
              if (depth != null)
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: depth.color.withValues(alpha: 0.55),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(height: 1, color: AppColors.borderSubtle),
          const SizedBox(height: AppSpacing.sm),
          _DetailRow(
              label: 'Accessible',
              value: zone.accessible ? 'Yes' : 'No (Reef)'),
          _DetailRow(label: 'Depth', value: zone.depth ?? 'n/a'),
          _DetailRow(label: 'Pole', value: zone.pole ?? 'n/a'),
          if (zone.mapRef != null) ...[
            const SizedBox(height: AppSpacing.md),
            NeonButton(
              title: 'View on map',
              icon: Icons.map_outlined,
              onPressed: () =>
                  resolveLink(context, zone.mapRef!.toInternalLink()),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppTypography.caption)),
          Text(value, style: AppTypography.body),
        ],
      ),
    );
  }
}
