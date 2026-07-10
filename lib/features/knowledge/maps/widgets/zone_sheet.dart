import 'package:flutter/material.dart';

import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import 'map_theme_scope.dart';
import 'zone_fields_renderer.dart';

/// Bottom sheet describing a tapped zone: its name, a favorite toggle, and its
/// schema-driven fields. Draggable (peek → full), GlassCard-styled but tinted by
/// the zone's resolved [MapTheme], which it also publishes via [MapThemeScope]
/// for the [ZoneFieldsRenderer].
///
/// Favorites are namespaced `mapId/zoneId` under [FavoriteKind.mapZone] so the
/// same zone id in two maps never collides.
class ZoneSheet extends StatelessWidget {
  const ZoneSheet({
    super.key,
    required this.zone,
    required this.fieldsSchema,
    required this.theme,
    required this.mapId,
    this.onClose,
    this.scrollController,
  });

  final MapZone zone;
  final List<ZoneFieldSpec> fieldsSchema;
  final MapTheme theme;
  final String mapId;
  final VoidCallback? onClose;

  /// When hosted directly (e.g. in tests) a caller may supply the scroll
  /// controller; otherwise a [DraggableScrollableSheet] provides one.
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context) {
    if (scrollController != null) {
      return MapThemeScope(
        theme: theme,
        child: _surface(_body(scrollController!)),
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
        builder: (context, controller) => _surface(_body(controller)),
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

  Widget _body(ScrollController controller) {
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
        ZoneFieldsRenderer(fieldsSchema: fieldsSchema, fields: zone.fields),
      ],
    );
  }
}
