import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import 'map_icons.dart';
import 'maps_how_it_works.dart';

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

/// What the discreet update banner should say, if anything.
enum _UpdateBanner {
  /// Nothing to show.
  none,

  /// A newer pack was fetched + installed this session; it activates on the next
  /// entry (never swapped under the user's feet — §4.7).
  ready,

  /// The published content needs a newer app than this build (minAppVersion
  /// gate) — point the user at an app-store update.
  updateApp,
}

class _MapsGalleryViewState extends ConsumerState<MapsGalleryView> {
  bool _seedActivated = false;

  /// Result of this session's background update check, surfaced as a banner.
  _UpdateBanner _banner = _UpdateBanner.none;

  final TextEditingController _searchController = TextEditingController();

  /// Debounced search query driving [mapZoneSearchProvider]. Empty → the gallery
  /// shows the map cards; non-empty → it shows FTS results.
  String _query = '';
  Timer? _debounce;

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

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  /// Debounce keystrokes (~280ms) so the FTS query fires once the user pauses,
  /// not on every character.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () {
      if (!mounted) return;
      setState(() => _query = value.trim());
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() => _query = '');
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
        if (mounted) setState(() => _banner = _UpdateBanner.ready);
      } else if (outcome is MapUpdateBlockedByAppVersion) {
        // Newer content exists but this build is too old to accept it.
        if (mounted) setState(() => _banner = _UpdateBanner.updateApp);
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
        actions: [
          IconButton(
            tooltip: 'How interactive maps work',
            icon: const Icon(Icons.info_outline),
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => const MapsHowItWorksView(),
            ),
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
            data: (manifest) {
              final hasMaps = (manifest?.maps.isNotEmpty ?? false);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_banner != _UpdateBanner.none) ...[
                    _MapUpdateBanner(
                      kind: _banner,
                      onDismiss: () =>
                          setState(() => _banner = _UpdateBanner.none),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  // The zone search box only makes sense once something is
                  // installed; otherwise fall straight through to the empty/error
                  // states below.
                  if (hasMaps) ...[
                    _ZoneSearchField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      onClear: _clearSearch,
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (_query.isNotEmpty)
                    _SearchResults(query: _query)
                  else
                    _body(manifest, seed),
                ],
              );
            },
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

/// Search box over installed zones (FTS). Debounced by the parent.
class _ZoneSearchField extends StatelessWidget {
  const _ZoneSearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: AppTypography.body,
      decoration: InputDecoration(
        hintText: 'Search zones across maps',
        hintStyle: AppTypography.body.copyWith(color: AppColors.textDim),
        prefixIcon:
            const Icon(Icons.search, color: AppColors.textSecondary),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close, color: AppColors.textSecondary),
                tooltip: 'Clear search',
                onPressed: onClear,
              ),
        filled: true,
        fillColor: AppColors.bgGlass,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: AppSpacing.md),
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
    );
  }
}

/// FTS results for the active query, each row "Map › Zone" opening its map with
/// the zone pre-selected (`?zone=`). Only openable maps appear (the provider
/// drops unknown-type / draft / missing maps).
class _SearchResults extends ConsumerWidget {
  const _SearchResults({required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mapZoneSearchProvider(query));
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.only(top: AppSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.only(top: AppSpacing.lg),
        child: Text(
          friendlyError(e, fallback: "Couldn't run that search."),
          style: AppTypography.body.copyWith(color: AppColors.accentDanger),
        ),
      ),
      data: (results) {
        if (results.isEmpty) {
          return Padding(
            padding: const EdgeInsets.only(top: AppSpacing.lg),
            child: Text(
              'No zones match “$query”.',
              style: AppTypography.caption,
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final r in results) ...[
              _SearchResultRow(result: r),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
        );
      },
    );
  }
}

class _SearchResultRow extends StatelessWidget {
  const _SearchResultRow({required this.result});

  final MapZoneSearchResult result;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${result.zoneName}, in ${result.mapTitle}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push(
          '/knowledge/maps/${Uri.encodeComponent(result.mapId)}'
          '?zone=${Uri.encodeComponent(result.zoneId)}',
        ),
        child: GlassCard(
          child: Row(
            children: [
              Icon(mapIconData(result.mapIcon),
                  color: AppColors.accentPrimary, size: 20),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      result.mapTitle.toUpperCase(),
                      style: AppTypography.mono.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.4,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(result.zoneName, style: AppTypography.headline),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right,
                  color: AppColors.textDim, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

/// Discreet banner surfaced at the top of the gallery after a background update
/// check. [_UpdateBanner.ready] tells the user a fresher pack is installed and
/// will show on the next open (we never swap content under their feet, §4.7);
/// [_UpdateBanner.updateApp] points them at an app-store update when the content
/// needs a newer build than this one.
class _MapUpdateBanner extends StatelessWidget {
  const _MapUpdateBanner({required this.kind, required this.onDismiss});

  final _UpdateBanner kind;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final updateApp = kind == _UpdateBanner.updateApp;
    final accent =
        updateApp ? AppColors.accentWarn : AppColors.accentPrimary;
    final icon = updateApp ? Icons.system_update : Icons.download_done;
    final title = updateApp ? 'Update Underdeck' : 'New maps ready';
    final message = updateApp
        ? 'Newer map content is available but needs a newer version of '
            'Underdeck. Update the app to get it.'
        : 'Updated map content was downloaded and will appear the next time '
            'you open Interactive maps.';
    return Semantics(
      liveRegion: true,
      label: '$title. $message',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: accent.withValues(alpha: 0.45)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: accent, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        color: accent,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(message, style: AppTypography.caption),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              IconButton(
                iconSize: 18,
                visualDensity: VisualDensity.compact,
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
                tooltip: 'Dismiss',
                icon: const Icon(Icons.close, color: AppColors.textSecondary),
                onPressed: onDismiss,
              ),
            ],
          ),
        ),
      ),
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
