import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../colors.dart';
import '../spacing.dart';
import '../typography.dart';
import 'animated_primitives.dart';
import 'page_scroll_view.dart';

/// Opaque ESSI banner shown at the top of every main page (and inside scroll
/// content on detail pages). Always fully solid so it covers whatever sits
/// behind it.
///
/// - The trailing `ESSI//XXX` value is scroll-driven when a [scrollOffset]
///   listenable is passed (preferred — main pages create a ScrollController
///   shared with PageScrollView and expose its offset via a ValueNotifier).
///   When [scrollOffset] is null, the header falls back to a [ScrollOffsetScope]
///   ancestor (legacy detail pages). When neither is available, the value is
///   static.
/// - [actions] renders trailing icon widgets to the right of the sector code,
///   typically a `+` button for the page's primary creation action.
class TransmissionHeader extends StatefulWidget {
  const TransmissionHeader({
    super.key,
    required this.label,
    this.sector,
    this.scrollOffset,
    this.actions = const [],
  });

  final String label;
  final String? sector;
  final ValueListenable<double>? scrollOffset;
  final List<Widget> actions;

  @override
  State<TransmissionHeader> createState() => _TransmissionHeaderState();
}

class _TransmissionHeaderState extends State<TransmissionHeader> {
  late final int _seed;

  @override
  void initState() {
    super.initState();
    _seed = math.Random().nextInt(900);
  }

  /// Derives a 3-digit sector code from the [scrollOffset] in pixels. The seed
  /// is fixed per header instance so two pages don't share the same number.
  String _sectorFor(double scrollOffset) {
    if (widget.sector != null) return widget.sector!;
    final ticks = scrollOffset.abs() ~/ 4; // changes every 4 logical pixels
    final value = 100 + ((_seed + ticks.toInt()) % 900);
    return 'ESSI//$value';
  }

  Widget _build(String sector) {
    return Container(
      // Fully opaque — no glass, no transparency. The page content scrolls
      // *between* this banner and the bottom nav, never behind either.
      color: AppColors.bgDeepest,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 6,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: AppColors.borderSubtle, width: 1),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              const PulsingDot(color: AppColors.accentSuccess),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  widget.label.toUpperCase(),
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.mono.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                    color: AppColors.accentPrimary,
                  ),
                ),
              ),
              Text(
                sector,
                style: AppTypography.mono.copyWith(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textDim,
                ),
              ),
              if (widget.actions.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.sm),
                ...widget.actions,
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final explicit = widget.scrollOffset;
    if (explicit != null) {
      return ValueListenableBuilder<double>(
        valueListenable: explicit,
        builder: (context, offset, _) => _build(_sectorFor(offset)),
      );
    }
    final scoped = ScrollOffsetScope.maybeOf(context);
    if (scoped != null) {
      return ValueListenableBuilder<double>(
        valueListenable: scoped,
        builder: (context, offset, _) => _build(_sectorFor(offset)),
      );
    }
    return _build(_sectorFor(0));
  }
}
