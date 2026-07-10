import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../data/map_pins_repository.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import 'map_pin_editor.dart';
import 'map_theme_scope.dart';
import 'map_zone_share_card.dart';
import 'zone_fields_renderer.dart';

/// Bottom sheet describing a tapped zone: its name, a favorite toggle, and its
/// schema-driven fields. Draggable (peek → full), GlassCard-styled but tinted by
/// the zone's resolved [MapTheme], which it also publishes via [MapThemeScope]
/// for the [ZoneFieldsRenderer].
///
/// Favorites are namespaced `mapId/zoneId` under [FavoriteKind.mapZone] so the
/// same zone id in two maps never collides.
class ZoneSheet extends ConsumerWidget {
  const ZoneSheet({
    super.key,
    required this.zone,
    required this.fieldsSchema,
    required this.theme,
    required this.mapId,
    this.mapTitle = '',
    this.onClose,
    this.scrollController,
  });

  final MapZone zone;
  final List<ZoneFieldSpec> fieldsSchema;
  final MapTheme theme;
  final String mapId;

  /// Title of the owning map, used for the branded share card header
  /// (AUDIT-V2 §6.8). Empty when a caller doesn't supply one.
  final String mapTitle;

  final VoidCallback? onClose;

  /// When hosted directly (e.g. in tests) a caller may supply the scroll
  /// controller; otherwise a [DraggableScrollableSheet] provides one.
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (scrollController != null) {
      return MapThemeScope(
        theme: theme,
        child: _surface(_body(context, ref, scrollController!)),
      );
    }
    return MapThemeScope(
      theme: theme,
      child: DraggableScrollableSheet(
        initialChildSize: 0.42,
        minChildSize: 0.22,
        maxChildSize: 0.9,
        expand: false,
        snap: true,
        snapSizes: const [0.42, 0.9],
        builder: (context, controller) =>
            _surface(_body(context, ref, controller)),
      ),
    );
  }

  Widget _surface(Widget child) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
        border: Border(
          top: BorderSide(color: theme.zoneStroke.withValues(alpha: 0.35)),
        ),
        boxShadow: [
          BoxShadow(
            color: theme.glow.withValues(alpha: 0.18),
            blurRadius: 24,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
        child: child,
      ),
    );
  }

  /// Exports this zone as a branded PNG via [ShareCardCapture] (AUDIT-V2 §6.8).
  /// Game data only (map title, zone name, schema fields) — no personal note.
  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    final ok = await ShareCardCapture.share(
      context: context,
      card: MapZoneShareCard(
        mapTitle: mapTitle,
        zone: zone,
        fieldsSchema: fieldsSchema,
        theme: theme,
      ),
      fileName: 'underdeck-zone-$mapId-${zone.id}.png',
      text: 'Underdeck map · ${zone.name}',
      sharePositionOrigin: ShareCardCapture.originRectFor(context),
    );
    if (!ok && context.mounted) {
      ShareCardCapture.showShareFailure(context);
    }
  }

  Widget _body(BuildContext context, WidgetRef ref, ScrollController controller) {
    final pin = ref.watch(zonePinProvider(MapZoneRef(mapId, zone.id))).valueOrNull;
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.label.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  zone.name,
                  style: AppTypography.title.copyWith(
                    fontFamily: theme.fontFamily,
                    color: theme.label,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            FavoriteButton(
              kind: FavoriteKind.mapZone,
              id: '$mapId/${zone.id}',
              activeColor: theme.accent,
            ),
            IconButton(
              tooltip: 'Share zone',
              visualDensity: VisualDensity.compact,
              icon: Icon(
                Icons.ios_share,
                size: 20,
                color: theme.accent,
              ),
              onPressed: () => _share(context, ref),
            ),
            if (onClose != null)
              IconButton(
                tooltip: 'Close',
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  Icons.close_rounded,
                  color: theme.label.withValues(alpha: 0.7),
                ),
                onPressed: onClose,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _PinSection(
          note: pin?.note,
          theme: theme,
          onEdit: () => MapPinEditor.show(
            context,
            mapId: mapId,
            zoneId: zone.id,
            zoneName: zone.name,
            theme: theme,
            initialNote: pin?.note ?? '',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ZoneFieldsRenderer(fieldsSchema: fieldsSchema, fields: zone.fields),
      ],
    );
  }
}

/// The personal-note affordance inside the [ZoneSheet]: an "Add note" prompt
/// when the zone has no pin, or the note text with an Edit control when it does.
class _PinSection extends StatelessWidget {
  const _PinSection({
    required this.note,
    required this.theme,
    required this.onEdit,
  });

  final String? note;
  final MapTheme theme;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final hasNote = note != null && note!.trim().isNotEmpty;
    return Semantics(
      button: true,
      label: hasNote ? 'Edit your note for this zone' : 'Add a note to this zone',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onEdit,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.bgGlass,
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(
              color: hasNote
                  ? theme.accent.withValues(alpha: 0.5)
                  : AppColors.borderSubtle,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                hasNote ? Icons.push_pin : Icons.push_pin_outlined,
                size: 18,
                color: hasNote
                    ? theme.accent
                    : theme.label.withValues(alpha: 0.5),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: hasNote
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MY NOTE',
                            style: AppTypography.mono.copyWith(
                              fontSize: 10,
                              letterSpacing: 1.5,
                              fontWeight: FontWeight.w600,
                              color: theme.accent,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            note!.trim(),
                            style: AppTypography.body
                                .copyWith(color: theme.label, height: 1.4),
                          ),
                        ],
                      )
                    : Padding(
                        padding: const EdgeInsets.symmetric(vertical: 1),
                        child: Text(
                          'Add note / pin',
                          style: AppTypography.body.copyWith(
                            color: theme.label.withValues(alpha: 0.75),
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Icon(
                hasNote ? Icons.edit_outlined : Icons.add,
                size: 18,
                color: theme.label.withValues(alpha: 0.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
