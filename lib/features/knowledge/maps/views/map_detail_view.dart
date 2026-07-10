import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error_text.dart';
import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../captures/widgets/tag_chip.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../data/map_content_repository.dart';
import '../domain/map_enums.dart';
import '../domain/map_models.dart';
import '../widgets/flat_map_viewport.dart';
import '../widgets/globe_viewport.dart';
import 'map_zone_list_view.dart';

/// Map detail route (`/knowledge/maps/:id`). Dispatches on the installed
/// document's type: flat maps render the interactive [FlatMapViewport], sphere
/// maps the interactive [GlobeViewport]; anything missing (a stale deep link to
/// a removed/draft map) shows a real not-found state rather than spinning
/// forever (audit fallback requirement).
class MapDetailView extends ConsumerStatefulWidget {
  const MapDetailView({super.key, required this.id, this.initialZoneId});

  final String id;

  /// Zone (from `?zone=` — a search result or an `underdeck://map` deep link) to
  /// pre-select + center on entry. `null` for a plain map open.
  final String? initialZoneId;

  @override
  ConsumerState<MapDetailView> createState() => _MapDetailViewState();
}

class _MapDetailViewState extends ConsumerState<MapDetailView> {
  /// Selected option values per filterable enum field key (AND across fields, OR
  /// within a field) — the canvas filter. Mirrors [MapZoneListView]'s model.
  final Map<String, Set<String>> _filters = {};

  /// Zone ids failing the active filter, pushed to the canvas painters (dimmed)
  /// without rebuilding the viewport / resetting its transform.
  final ValueNotifier<Set<String>> _dimmed =
      ValueNotifier<Set<String>>(const {});

  @override
  void dispose() {
    _dimmed.dispose();
    super.dispose();
  }

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
                  builder: (_) => MapZoneListView(
                    document: doc,
                    title: title,
                    // Carry the canvas filter over so the list hides exactly the
                    // zones the canvas dims.
                    initialFilters: _filters,
                  ),
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

    // Schema gate: a document authored against a newer schema than this build
    // understands is not openable — even when its `type` is a known one — and
    // points the user at an app update (AUDIT-V2 §4.7).
    if (doc.schemaVersion > kSupportedMapSchemaVersion) {
      return const _MessagePane(
        icon: Icons.system_update,
        title: 'Update required',
        message: 'This map needs a newer version of Underdeck to open. Update '
            'the app from your app store to view it.',
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
        return _withFilters(
          doc,
          _FlatPane(
            mapId: widget.id,
            document: doc,
            dimmed: _dimmed,
            initialZoneId: widget.initialZoneId,
          ),
        );
      case MapType.sphere:
        if (doc.sphere == null) {
          return const _MessagePane(
            icon: Icons.warning_amber,
            title: 'Update required',
            message: 'This globe needs a newer app version to display.',
          );
        }
        return _withFilters(
          doc,
          _SpherePane(
            document: doc,
            dimmed: _dimmed,
            initialZoneId: widget.initialZoneId,
          ),
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

  /// Filterable enum fields for [doc] — only enum fields with options (the
  /// validator already forces `filterable` off for every other type).
  List<ZoneFieldSpec> _filterableFields(MapDocument doc) => [
        for (final f in doc.fieldsSchema)
          if (f.filterable &&
              f.type == ZoneFieldType.enumeration &&
              (f.options?.isNotEmpty ?? false))
            f,
      ];

  void _toggleFilter(MapDocument doc, String key, String option) {
    setState(() {
      final set = _filters.putIfAbsent(key, () => <String>{});
      if (!set.remove(option)) set.add(option);
    });
    _recomputeDimmed(doc);
  }

  /// Recomputes the dimmed set: a zone is dimmed when it fails any active filter
  /// (AND across fields, OR within a field). No active filter → nothing dimmed.
  void _recomputeDimmed(MapDocument doc) {
    final active = {
      for (final e in _filters.entries)
        if (e.value.isNotEmpty) e.key: e.value,
    };
    if (active.isEmpty) {
      _dimmed.value = const {};
      return;
    }
    final dimmed = <String>{};
    for (final z in doc.zones) {
      for (final entry in active.entries) {
        final v = z.fields[entry.key];
        if (v is! String || !entry.value.contains(v)) {
          dimmed.add(z.id);
          break;
        }
      }
    }
    _dimmed.value = dimmed;
  }

  /// Overlays a filter-chip bar on [pane] when [doc] has filterable fields;
  /// otherwise returns the pane unchanged.
  Widget _withFilters(MapDocument doc, Widget pane) {
    final fields = _filterableFields(doc);
    if (fields.isEmpty) return pane;
    return Stack(
      children: [
        Positioned.fill(child: pane),
        Positioned(
          top: MediaQuery.paddingOf(context).top + kToolbarHeight,
          left: 0,
          right: 0,
          child: _FilterBar(
            fields: fields,
            filters: _filters,
            onToggle: (key, opt) => _toggleFilter(doc, key, opt),
          ),
        ),
      ],
    );
  }
}

/// A horizontally-scrolling row of filter chips ([TagChip]) grouped by field.
/// Sits over the top of the canvas; tapping a chip dims the zones that fail it.
class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.fields,
    required this.filters,
    required this.onToggle,
  });

  final List<ZoneFieldSpec> fields;
  final Map<String, Set<String>> filters;
  final void Function(String key, String option) onToggle;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.bgDeepest.withValues(alpha: 0.85),
            AppColors.bgDeepest.withValues(alpha: 0.0),
          ],
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.md),
        child: Row(
          children: [
            for (final field in fields)
              for (final opt in field.options ?? const <String>[])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: TagChip(
                    label: opt,
                    selected: filters[field.key]?.contains(opt) ?? false,
                    onTap: () => onToggle(field.key, opt),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

/// The interactive flat-map surface, semantically labelled so screen-reader
/// users are pointed at the "List of zones" alternative (the canvas itself is
/// not explorable by touch exploration).
class _FlatPane extends ConsumerWidget {
  const _FlatPane({
    required this.mapId,
    required this.document,
    required this.dimmed,
    this.initialZoneId,
  });

  final String mapId;
  final MapDocument document;
  final ValueListenable<Set<String>> dimmed;
  final String? initialZoneId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bytes = ref.watch(mapBackgroundBytesProvider(mapId)).valueOrNull;
    return Semantics(
      container: true,
      label: 'Interactive map. Tap a zone for details, or use the '
          'List of zones button in the top bar.',
      child: FlatMapViewport(
        document: document,
        backgroundBytes: bytes,
        dimmed: dimmed,
        initialZoneId: initialZoneId,
      ),
    );
  }
}

/// The interactive globe surface, semantically labelled so screen-reader users
/// are pointed at the "List of zones" alternative (the canvas itself, and the
/// far/limb hemispheres, are not explorable by touch exploration — §4.8 a11y).
class _SpherePane extends StatelessWidget {
  const _SpherePane({
    required this.document,
    required this.dimmed,
    this.initialZoneId,
  });

  final MapDocument document;
  final ValueListenable<Set<String>> dimmed;
  final String? initialZoneId;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Interactive globe. Drag to rotate, pinch to zoom, tap a region '
          'for details, or use the List of zones button in the top bar.',
      child: GlobeViewport(
        document: document,
        dimmed: dimmed,
        initialZoneId: initialZoneId,
      ),
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
