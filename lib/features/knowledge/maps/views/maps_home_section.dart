import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../data/map_content_repository.dart';
import '../data/map_seed_importer.dart';
import '../domain/map_models.dart';
import 'map_gallery_card.dart';

/// Number of map cards shown inline on the Knowledge home before deferring the
/// rest to the full gallery via a "See all" row.
const int _kHomeMaxCards = 3;

/// The "Interactive maps" block pinned near the top of the Knowledge home.
///
/// This is also the **seed-import trigger point** (first Knowledge entry, §4.7):
/// it watches [mapSeedImportProvider] to run the one-time bundled-seed import,
/// and once that succeeds it invalidates [mapsManifestProvider] so the freshly
/// seeded pack activates — at screen entry, never under the user's feet. When
/// the seed import fails with nothing else installed it shows a real retry card
/// instead of a mystery blank.
class MapsHomeSection extends ConsumerStatefulWidget {
  const MapsHomeSection({super.key});

  @override
  ConsumerState<MapsHomeSection> createState() => _MapsHomeSectionState();
}

class _MapsHomeSectionState extends ConsumerState<MapsHomeSection> {
  bool _activated = false;

  @override
  Widget build(BuildContext context) {
    // Run + observe the one-time seed import; activate its pack on success.
    ref.listen<AsyncValue<MapSeedOutcome>>(mapSeedImportProvider,
        (prev, next) {
      final outcome = next.valueOrNull;
      if (outcome is MapSeedImported && !_activated) {
        _activated = true;
        ref.invalidate(mapsManifestProvider);
      }
    });
    final seed = ref.watch(mapSeedImportProvider);
    final manifest = ref.watch(mapsManifestProvider).valueOrNull;

    final maps = <MapDescriptor>[...?manifest?.maps]
      ..sort((a, b) => a.order.compareTo(b.order));

    // Nothing installed yet. If the seed genuinely failed, offer a retry;
    // otherwise stay silent while it imports (avoids an empty header flash).
    if (maps.isEmpty) {
      final failure = seed.valueOrNull;
      if (failure is MapSeedFailed) {
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: _SeedFailureCard(failure: failure),
        );
      }
      return const SizedBox.shrink();
    }

    final shown = maps.take(_kHomeMaxCards).toList();
    final hasMore = maps.length > shown.length;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(
            count: maps.length,
            onTap: () => context.push('/knowledge/maps'),
          ),
          const SizedBox(height: AppSpacing.md),
          for (final d in shown) ...[
            MapGalleryCard(descriptor: d),
            const SizedBox(height: AppSpacing.md),
          ],
          if (hasMore)
            _SeeAllRow(
              remaining: maps.length - shown.length,
              onTap: () => context.push('/knowledge/maps'),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Interactive maps, $count available. Open gallery',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Row(
          children: [
            const Icon(Icons.map, color: AppColors.accentPrimary, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'INTERACTIVE MAPS',
                style: AppTypography.mono.copyWith(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2,
                  color: AppColors.accentPrimary,
                ),
              ),
            ),
            Text('View all',
                style: AppTypography.caption
                    .copyWith(color: AppColors.textSecondary)),
            const Icon(Icons.chevron_right,
                color: AppColors.textDim, size: 18),
          ],
        ),
      ),
    );
  }
}

class _SeeAllRow extends StatelessWidget {
  const _SeeAllRow({required this.remaining, required this.onTap});

  final int remaining;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'See all maps, $remaining more',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(color: AppColors.borderSubtle),
            color: AppColors.bgGlass,
          ),
          child: Row(
            children: [
              const Icon(Icons.grid_view_rounded,
                  color: AppColors.accentPrimary, size: 18),
              const SizedBox(width: AppSpacing.sm),
              Text('See all maps ($remaining more)',
                  style: AppTypography.body),
              const Spacer(),
              const Icon(Icons.chevron_right, color: AppColors.textDim),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown only when the bundled seed failed to import and nothing else is
/// installed — a real empty state with a Retry that re-runs the import.
class _SeedFailureCard extends ConsumerWidget {
  const _SeedFailureCard({required this.failure});

  final MapSeedFailed failure;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final message = failure.diskFull
        ? 'Storage is full, so offline maps could not be set up. '
            'Free up some space and try again.'
        : "Couldn't set up offline maps.";
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                failure.diskFull ? Icons.sd_card_alert : Icons.map_outlined,
                color: AppColors.accentWarn,
                size: 18,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Interactive maps', style: AppTypography.headline),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: AppTypography.caption),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => ref.invalidate(mapSeedImportProvider),
              icon: const Icon(Icons.refresh,
                  color: AppColors.accentPrimary, size: 18),
              label: Text('Retry',
                  style: AppTypography.body
                      .copyWith(color: AppColors.accentPrimary)),
            ),
          ),
        ],
      ),
    );
  }
}
