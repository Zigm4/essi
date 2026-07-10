import 'package:flutter/material.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../domain/map_enums.dart';
import '../domain/map_geometry.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import '../widgets/zone_sheet.dart';

/// Accessible, non-spatial alternative to the map canvas: a searchable,
/// filterable, sortable **list of zones**. This one view covers screen-reader
/// access for both 2D and (future) 3D maps, tiny zones, and limb-picking on a
/// globe — anything that touch-exploration of a painted canvas can't reach.
///
/// Tapping a row opens the exact same [ZoneSheet] the canvas uses, tinted with
/// the zone's resolved theme, so the two entry points stay consistent.
class MapZoneListView extends StatefulWidget {
  const MapZoneListView({
    super.key,
    required this.document,
    required this.title,
    this.initialFilters = const {},
  });

  final MapDocument document;
  final String title;

  /// Filters carried over from the map-detail canvas so the two stay in sync
  /// (canvas dims failing zones; this list hides them). Copied on init.
  final Map<String, Set<String>> initialFilters;

  @override
  State<MapZoneListView> createState() => _MapZoneListViewState();
}

class _MapZoneListViewState extends State<MapZoneListView> {
  String _query = '';
  bool _ascending = true;

  /// Selected option values per filterable enum field key (AND across fields,
  /// OR within a field). Seeded from the canvas filters.
  late final Map<String, Set<String>> _filters = {
    for (final e in widget.initialFilters.entries) e.key: {...e.value},
  };

  late final MapTheme _baseTheme = widget.document.theme.sanitize();

  List<ZoneFieldSpec> get _filterableFields => [
        for (final f in widget.document.fieldsSchema)
          if (f.filterable &&
              f.type == ZoneFieldType.enumeration &&
              (f.options?.isNotEmpty ?? false))
            f,
      ];

  List<MapZone> get _visibleZones {
    final q = _query.trim().toLowerCase();
    final zones = widget.document.zones.where((z) {
      if (q.isNotEmpty && !z.name.toLowerCase().contains(q)) return false;
      for (final entry in _filters.entries) {
        if (entry.value.isEmpty) continue;
        final value = z.fields[entry.key];
        if (value is! String || !entry.value.contains(value)) return false;
      }
      return true;
    }).toList();
    zones.sort((a, b) {
      final cmp = a.name.toLowerCase().compareTo(b.name.toLowerCase());
      return _ascending ? cmp : -cmp;
    });
    return zones;
  }

  void _toggleFilter(String key, String option) {
    setState(() {
      final set = _filters.putIfAbsent(key, () => <String>{});
      if (!set.remove(option)) set.add(option);
    });
  }

  void _openZone(MapZone zone) {
    final theme = zoneTheme(_baseTheme, zone.themeOverride);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ZoneSheet(
        zone: zone,
        fieldsSchema: widget.document.fieldsSchema,
        theme: theme,
        mapId: widget.document.id,
        onClose: () => Navigator.of(sheetContext).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final zones = _visibleZones;
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Zones · ${widget.title}', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
        actions: [
          IconButton(
            tooltip: _ascending ? 'Sort Z to A' : 'Sort A to Z',
            icon: Icon(_ascending
                ? Icons.arrow_downward
                : Icons.arrow_upward),
            onPressed: () => setState(() => _ascending = !_ascending),
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
              _SearchField(onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: AppSpacing.sm),
              for (final field in _filterableFields)
                _FilterGroup(
                  field: field,
                  selected: _filters[field.key] ?? const {},
                  onToggle: (opt) => _toggleFilter(field.key, opt),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Text(
                  '${zones.length} zone${zones.length == 1 ? '' : 's'}',
                  style: AppTypography.caption,
                ),
              ),
              if (zones.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Text('No zones match.', style: AppTypography.caption),
                )
              else
                for (final z in zones) ...[
                  _ZoneRow(zone: z, onTap: () => _openZone(z)),
                  const SizedBox(height: AppSpacing.sm),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      decoration: InputDecoration(
        hintText: 'Search zones',
        hintStyle: AppTypography.body.copyWith(color: AppColors.textDim),
        prefixIcon:
            const Icon(Icons.search, color: AppColors.textSecondary),
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
      style: AppTypography.body,
      onChanged: onChanged,
    );
  }
}

class _FilterGroup extends StatelessWidget {
  const _FilterGroup({
    required this.field,
    required this.selected,
    required this.onToggle,
  });

  final ZoneFieldSpec field;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    final options = field.options ?? const [];
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            field.label.toUpperCase(),
            style: AppTypography.mono.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final opt in options)
                _FilterChip(
                  label: opt,
                  active: selected.contains(opt),
                  onTap: () => onToggle(opt),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      inMutuallyExclusiveGroup: false,
      selected: active,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            color: active
                ? AppColors.accentPrimary.withValues(alpha: 0.16)
                : AppColors.bgGlass,
            border: Border.all(
              color: active
                  ? AppColors.borderGlow
                  : AppColors.borderSubtle,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (active) ...[
                const Icon(Icons.check,
                    size: 14, color: AppColors.accentPrimary),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: AppTypography.caption.copyWith(
                  color: active
                      ? AppColors.accentPrimary
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ZoneRow extends StatelessWidget {
  const _ZoneRow({required this.zone, required this.onTap});

  final MapZone zone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final kind = _kindLabel(zone.geometry);
    return Semantics(
      button: true,
      label: '${zone.name}, $kind',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: GlassCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(zone.name, style: AppTypography.headline),
                    const SizedBox(height: 2),
                    Text(kind, style: AppTypography.caption),
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

String _kindLabel(ZoneGeometry g) => switch (g) {
      PolygonGeometry() => 'Region',
      SphericalPolygonGeometry() => 'Region',
      MarkerGeometry() => 'Marker',
      SphericalCapGeometry() => 'Area',
      UnknownGeometry() => 'Unavailable',
    };
