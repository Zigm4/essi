import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error_text.dart';
import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../data/map_content_repository.dart';
import '../domain/map_enums.dart';
import '../domain/map_models.dart';
import '../widgets/flat_map_viewport.dart';
import 'map_zone_list_view.dart';

/// Map detail route (`/knowledge/maps/:id`). Dispatches on the installed
/// document's type: flat maps render the interactive [FlatMapViewport]; sphere
/// maps show a "coming soon" placeholder until D2; anything missing (a stale
/// deep link to a removed/draft map) shows a real not-found state rather than
/// spinning forever (audit fallback requirement).
class MapDetailView extends ConsumerStatefulWidget {
  const MapDetailView({super.key, required this.id});

  final String id;

  @override
  ConsumerState<MapDetailView> createState() => _MapDetailViewState();
}

class _MapDetailViewState extends ConsumerState<MapDetailView> {
  @override
  void initState() {
    super.initState();
    // Activate any freshly installed pack at entry (never under the user's
    // feet, §4.7): re-read this map's document + background from the store.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.invalidate(mapDocumentProvider(widget.id));
      ref.invalidate(mapBackgroundBytesProvider(widget.id));
    });
  }

  @override
  Widget build(BuildContext context) {
    final docAsync = ref.watch(mapDocumentProvider(widget.id));
    final manifest = ref.watch(mapsManifestProvider).valueOrNull;
    final descriptor =
        manifest?.maps.firstWhereOrNull((m) => m.id == widget.id);
    final title = descriptor?.title ?? docAsync.valueOrNull?.id ?? 'Map';

    final doc = docAsync.valueOrNull;
    final canListZones = doc != null && doc.zones.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        // Slight scrim so the bar stays legible over any map background.
        backgroundColor: AppColors.bgDeepest.withValues(alpha: 0.55),
        elevation: 0,
        title: Text(title, style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
        actions: [
          if (doc != null)
            FavoriteButton(
              kind: FavoriteKind.map,
              id: widget.id,
            ),
          if (canListZones)
            IconButton(
              tooltip: 'List of zones',
              icon: const Icon(Icons.format_list_bulleted),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => MapZoneListView(document: doc, title: title),
                ),
              ),
            ),
        ],
      ),
      body: AppBackground(
        child: docAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _MessagePane(
            icon: Icons.error_outline,
            title: "Couldn't open this map",
            message: friendlyError(e, fallback: 'The map failed to load.'),
          ),
          data: (doc) => _dispatch(doc, descriptor),
        ),
      ),
    );
  }

  Widget _dispatch(MapDocument? doc, MapDescriptor? descriptor) {
    if (doc == null) {
      // Missing from the store: either a draft not yet published, or a stale
      // deep link to a map that no longer exists.
      if (descriptor?.draft ?? false) {
        return const _MessagePane(
          icon: Icons.edit_note,
          title: 'Draft map',
          message: 'This map is still a draft and is not available to open '
              'yet. It will unlock in a future content update.',
        );
      }
      return const _MessagePane(
        icon: Icons.map_outlined,
        title: 'Map not found',
        message: 'This map is no longer available. It may have been removed '
            'in a content update. Go back to the gallery to see current maps.',
      );
    }

    switch (doc.type) {
      case MapType.flat:
        if (doc.canvas == null) {
          return const _MessagePane(
            icon: Icons.warning_amber,
            title: 'Update required',
            message: 'This map needs a newer app version to display.',
          );
        }
        return _FlatPane(mapId: widget.id, document: doc);
      case MapType.sphere:
        return _MessagePane(
          icon: Icons.public,
          title: '3D globe coming soon',
          message: '${descriptor?.title ?? 'This map'} is a globe. Interactive '
              '3D maps arrive in a later build. Use "List of zones" above to '
              'browse its regions now.',
        );
      case MapType.unknown:
        return const _MessagePane(
          icon: Icons.warning_amber,
          title: 'Update required',
          message: 'This map uses a format this app version does not '
              'understand yet. Update the app to view it.',
        );
    }
  }
}

/// The interactive flat-map surface, semantically labelled so screen-reader
/// users are pointed at the "List of zones" alternative (the canvas itself is
/// not explorable by touch exploration).
class _FlatPane extends ConsumerWidget {
  const _FlatPane({required this.mapId, required this.document});

  final String mapId;
  final MapDocument document;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bytes = ref.watch(mapBackgroundBytesProvider(mapId)).valueOrNull;
    return Semantics(
      container: true,
      label: 'Interactive map. Tap a zone for details, or use the '
          'List of zones button in the top bar.',
      child: FlatMapViewport(document: document, backgroundBytes: bytes),
    );
  }
}

/// Centered icon + message used for the sphere placeholder, draft, not-found,
/// and update-required states.
class _MessagePane extends StatelessWidget {
  const _MessagePane({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: GlassCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: AppColors.accentPrimary, size: 22),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(title, style: AppTypography.title),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                style: AppTypography.body
                    .copyWith(color: AppColors.textSecondary, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
