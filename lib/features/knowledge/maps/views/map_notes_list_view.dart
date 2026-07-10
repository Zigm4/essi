import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../data/map_pins_repository.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import '../widgets/zone_sheet.dart';

/// "My map notes" — every zone in this map the user has pinned a personal note
/// to (Phase E §6.1). Reachable from the map-detail app bar. Tapping a row
/// opens the same [ZoneSheet] the canvas uses, so editing/deleting the note
/// happens through the one shared surface.
class MapNotesListView extends ConsumerWidget {
  const MapNotesListView({
    super.key,
    required this.document,
    required this.title,
  });

  final MapDocument document;
  final String title;

  void _openZone(BuildContext context, MapZone zone) {
    final baseTheme = document.theme.sanitize();
    final theme = zoneTheme(baseTheme, zone.themeOverride);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ZoneSheet(
        zone: zone,
        fieldsSchema: document.fieldsSchema,
        theme: theme,
        mapId: document.id,
        mapTitle: title,
        onClose: () => Navigator.of(sheetContext).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pinsAsync = ref.watch(mapPinsForMapProvider(document.id));
    final zonesById = {for (final z in document.zones) z.id: z};

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('My notes · $title', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: pinsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text("Couldn't load your notes.",
                  style: AppTypography.body),
            ),
          ),
          data: (pins) {
            // A pin can outlive a zone removed by a content update; skip those.
            final rows = [
              for (final pin in pins)
                if (zonesById[pin.zoneId] != null) (pin, zonesById[pin.zoneId]!),
            ];
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
                  Text(
                    '${rows.length} note${rows.length == 1 ? '' : 's'}',
                    style: AppTypography.caption,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (rows.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Text(
                        'No notes yet. Open a zone and tap "Add note / pin".',
                        style: AppTypography.caption,
                      ),
                    )
                  else
                    for (final (pin, zone) in rows) ...[
                      _NoteRow(
                        zoneName: zone.name,
                        note: pin.note,
                        onTap: () => _openZone(context, zone),
                        onDelete: () async {
                          Haptics.of(ref).selection();
                          await ref
                              .read(mapPinsRepositoryProvider)
                              .deletePin(pin.id);
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NoteRow extends StatelessWidget {
  const _NoteRow({
    required this.zoneName,
    required this.note,
    required this.onTap,
    required this.onDelete,
  });

  final String zoneName;
  final String note;
  final VoidCallback onTap;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Note on $zoneName',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: GlassCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2),
                child: Icon(Icons.push_pin,
                    color: AppColors.accentPrimary, size: 18),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(zoneName, style: AppTypography.headline),
                    const SizedBox(height: 4),
                    Text(
                      note.trim(),
                      style: AppTypography.body
                          .copyWith(color: AppColors.textSecondary),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Delete note',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.delete_outline,
                    color: AppColors.textDim, size: 20),
                onPressed: onDelete,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
