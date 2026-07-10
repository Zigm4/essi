import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error_text.dart';
import '../../../core/logging.dart';
import '../../../design_system/colors.dart';
import '../../../services/haptics.dart';
import '../data/favorites_repository.dart';

/// Reactive star/pin/bookmark toggle for any favoritable entity. Watches the
/// live favorite flag and flips it on tap. [icon]/[activeIcon] let callers
/// pick the metaphor (star for jobs/zones, bookmark for KB, pin for tracker)
/// while sharing the toggle + persistence logic.
class FavoriteButton extends ConsumerWidget {
  const FavoriteButton({
    super.key,
    required this.kind,
    required this.id,
    this.icon = Icons.star_border_rounded,
    this.activeIcon = Icons.star_rounded,
    this.size = 22,
    this.tooltip = 'Favorite',
    this.activeColor = AppColors.accentWarn,
  });

  final String kind;
  final String id;
  final IconData icon;
  final IconData activeIcon;
  final double size;
  final String tooltip;
  final Color activeColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ids =
        ref.watch(favoriteIdsProvider(kind)).valueOrNull ?? const <String>{};
    final isFav = ids.contains(id);
    return IconButton(
      tooltip: isFav ? 'Remove favorite' : tooltip,
      visualDensity: VisualDensity.compact,
      iconSize: size,
      padding: const EdgeInsets.all(6),
      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
      icon: Icon(
        isFav ? activeIcon : icon,
        color: isFav ? activeColor : AppColors.textDim,
      ),
      onPressed: () async {
        Haptics.of(ref).selection();
        try {
          await ref.read(favoritesRepositoryProvider).toggle(kind, id);
        } catch (e, st) {
          logError('Failed to toggle favorite ($kind/$id): $e', st);
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(friendlyError(e,
                    fallback: "Couldn't update favorite.")),
              ),
            );
          }
        }
      },
    );
  }
}
