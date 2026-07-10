import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../data/map_content_repository.dart';
import '../domain/map_enums.dart';
import '../domain/map_models.dart';
import 'map_icons.dart';

/// A single map entry in the gallery / Knowledge home: a [GlassCard] with a
/// small background thumbnail (falling back to the closed-enum icon), the map
/// title + subtitle, and a 'draft' badge. Taps route to the map detail.
///
/// The thumbnail is the map's `background` asset read from the offline store
/// (never the network) via [mapBackgroundBytesProvider]; while it resolves — or
/// when the map has no background — the icon tile stands in.
class MapGalleryCard extends ConsumerWidget {
  const MapGalleryCard({super.key, required this.descriptor});

  final MapDescriptor descriptor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bytes =
        ref.watch(mapBackgroundBytesProvider(descriptor.id)).valueOrNull;

    return Semantics(
      button: true,
      label: descriptor.draft
          ? '${descriptor.title}, draft'
          : descriptor.title,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push('/knowledge/maps/${descriptor.id}'),
        child: GlassCard(
          child: Row(
            children: [
              _Thumb(icon: descriptor.icon, bytes: bytes),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            descriptor.title,
                            style: AppTypography.headline,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (descriptor.draft) ...[
                          const SizedBox(width: AppSpacing.sm),
                          const _DraftBadge(),
                        ],
                      ],
                    ),
                    if (descriptor.subtitle != null &&
                        descriptor.subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        descriptor.subtitle!,
                        style: AppTypography.caption,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
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

class _Thumb extends StatelessWidget {
  const _Thumb({required this.icon, required this.bytes});

  final MapIcon icon;
  final Uint8List? bytes;

  @override
  Widget build(BuildContext context) {
    const double size = 48;
    // Decode the thumbnail at display size, not the map's intrinsic resolution
    // (backgrounds can be up to 4096² → ~67 MB decoded for a 48px tile).
    final decodePx =
        (size * MediaQuery.devicePixelRatioOf(context)).round().clamp(1, 256);
    final glyph = Icon(mapIconData(icon),
        color: AppColors.accentPrimary, size: 26);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.bgElevated,
          border: Border.all(color: AppColors.borderSubtle),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        alignment: Alignment.center,
        child: bytes == null
            ? glyph
            : Image.memory(
                bytes!,
                width: size,
                height: size,
                cacheWidth: decodePx,
                cacheHeight: decodePx,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                // A decode failure should fall back to the icon, never a
                // broken-image glyph.
                errorBuilder: (context, error, stack) => glyph,
              ),
      ),
    );
  }
}

class _DraftBadge extends StatelessWidget {
  const _DraftBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.accentWarn.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: AppColors.accentWarn.withValues(alpha: 0.45),
        ),
      ),
      child: Text(
        'DRAFT',
        style: AppTypography.mono.copyWith(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
          color: AppColors.accentWarn,
        ),
      ),
    );
  }
}
