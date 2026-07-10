import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/app_version.dart';
import '../../../../core/error_text.dart';
import '../../../../core/logging.dart';
import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/app_settings.dart';
import '../data/map_content_repository.dart';
import '../data/map_seed_importer.dart';
import '../domain/map_models.dart';
import 'map_gallery_card.dart';

/// Full-screen gallery of every installed map (route `/knowledge/maps`).
///
/// On entry it: (1) invalidates [mapsManifestProvider] so any pack installed by
/// a previous session's background update becomes visible now — at screen entry,
/// never under the user's feet (§4.7); (2) fires a throttled, non-blocking
/// `checkForUpdate` (guarded by the network + auto-update settings), installing
/// silently so the newer pack activates on the *next* entry. The bundled seed
/// guarantees there is always content offline.
class MapsGalleryView extends ConsumerStatefulWidget {
  const MapsGalleryView({super.key});

  @override
  ConsumerState<MapsGalleryView> createState() => _MapsGalleryViewState();
}

class _MapsGalleryViewState extends ConsumerState<MapsGalleryView> {
  bool _seedActivated = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Pick up anything installed since the last entry.
      ref.invalidate(mapsManifestProvider);
      _kickUpdateCheck();
    });
  }

  /// Fire-and-forget, non-blocking, fully guarded. Never rethrows.
  Future<void> _kickUpdateCheck() async {
    final settings = ref.read(appSettingsProvider);
    if (!settings.mapsNetworkEnabled || !settings.mapsAutoUpdate) return;
    try {
      final repo = await ref.read(mapContentRepositoryProvider.future);
      final version =
          ref.read(appVersionProvider).valueOrNull ?? AppVersion.fallback;
      final outcome = await repo.checkForUpdate(
        networkEnabled: settings.mapsNetworkEnabled,
        appVersion: version.version,
      );
      if (outcome is MapUpdateAvailable) {
        // Installs into the store transactionally; the previous pack stays
        // intact on any failure. Deliberately NOT invalidating here — the new
        // pack activates on the next screen entry (§4.7).
        await repo.install(outcome);
      }
    } catch (e, s) {
      // checkForUpdate never throws, but install can (integrity/transport).
      logError(e, s);
    }
  }

  @override
  Widget build(BuildContext context) {
    // If the gallery is the first surface entered (deep link / first launch),
    // the seed import may finish after our initState invalidate — activate it
    // when it lands so this screen shows the seeded content, not an empty state.
    ref.listen<AsyncValue<MapSeedOutcome>>(mapSeedImportProvider, (_, next) {
      if (next.valueOrNull is MapSeedImported && !_seedActivated) {
        _seedActivated = true;
        ref.invalidate(mapsManifestProvider);
      }
    });
    // Observe the seed import so a first-launch failure can surface a retry.
    final seed = ref.watch(mapSeedImportProvider).valueOrNull;
    final manifestAsync = ref.watch(mapsManifestProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Interactive maps', style: AppTypography.headline),
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
          child: manifestAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.only(top: AppSpacing.xxl),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xxl),
              child: Center(
                child: Text(
                  friendlyError(e, fallback: "Couldn't load maps."),
                  style: AppTypography.body
                      .copyWith(color: AppColors.accentDanger),
                ),
              ),
            ),
            data: (manifest) => _body(manifest, seed),
          ),
        ),
      ),
    );
  }

  Widget _body(MapsManifest? manifest, MapSeedOutcome? seed) {
    final maps = <MapDescriptor>[...?manifest?.maps]
      ..sort((a, b) => a.order.compareTo(b.order));

    if (maps.isEmpty) {
      if (seed is MapSeedFailed) {
        return _EmptyState(
          icon: seed.diskFull ? Icons.sd_card_alert : Icons.map_outlined,
          title: seed.diskFull ? 'Storage full' : "Couldn't set up maps",
          message: seed.diskFull
              ? 'Offline maps could not be set up because storage is full. '
                  'Free up some space and try again.'
              : 'The offline map set could not be prepared.',
          onRetry: () => ref.invalidate(mapSeedImportProvider),
        );
      }
      return const _EmptyState(
        icon: Icons.map_outlined,
        title: 'No maps yet',
        message: 'Interactive maps will appear here once they are installed.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final d in maps) ...[
          MapGalleryCard(descriptor: d),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xl),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppColors.accentWarn, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Text(title, style: AppTypography.headline),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(message, style: AppTypography.caption),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh,
                      color: AppColors.accentPrimary, size: 18),
                  label: Text('Retry',
                      style: AppTypography.body
                          .copyWith(color: AppColors.accentPrimary)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
