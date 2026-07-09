import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design_system/colors.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _items = [
    _NavItem(
      label: 'Tools',
      icon: Icons.handyman_outlined,
      selectedIcon: Icons.handyman,
    ),
    _NavItem(
      label: 'Notes',
      icon: Icons.note_alt_outlined,
      selectedIcon: Icons.note_alt,
    ),
    _NavItem(
      label: 'Hangar',
      icon: Icons.inventory_2_outlined,
      selectedIcon: Icons.inventory_2,
    ),
    _NavItem(
      label: 'Knowledge',
      icon: Icons.menu_book_outlined,
      selectedIcon: Icons.menu_book,
    ),
    _NavItem(
      label: 'Menu',
      icon: Icons.more_horiz,
      selectedIcon: Icons.more_horiz,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      // Bottom nav is opaque; the body should NOT extend behind it so that
      // page content scrolls *between* the top ESSI banner and the nav.
      extendBody: false,
      body: navigationShell,
      bottomNavigationBar: _UnderdeckTabBar(
        currentIndex: navigationShell.currentIndex,
        items: _items,
        onTap: (i) => navigationShell.goBranch(
          i,
          initialLocation: i == navigationShell.currentIndex,
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Floating glass capsule wrapping all tabs, with a second glass layer that
/// slides behind the active tab. Two stacked BackdropFilters give the
/// "glass on glass" effect requested for the selected item.
class _UnderdeckTabBar extends StatelessWidget {
  const _UnderdeckTabBar({
    required this.currentIndex,
    required this.items,
    required this.onTap,
  });

  static const double _baseHeight = 68;
  static const double _innerInset = 6;
  static const Duration _slide = Duration(milliseconds: 380);
  static const Curve _slideCurve = Curves.easeOutCubic;

  // F69: base label size, and the clamp applied to the user's text-scale
  // setting. The old FittedBox(scaleDown) cancelled the setting entirely; we
  // now let labels scale but cap growth at 1.3x and grow the capsule to match.
  static const double _labelFontSize = 10.5;
  static const double _maxLabelScale = 1.3;

  final int currentIndex;
  final List<_NavItem> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    // F69: clamp the ambient text scaler so oversized system settings can't
    // blow out the capsule, but the label still honours the user's preference.
    final labelScaler = mq.textScaler.clamp(
      minScaleFactor: 1.0,
      maxScaleFactor: _maxLabelScale,
    );
    // Grow the capsule by the extra height one scaled label line needs.
    final outerHeight =
        _baseHeight + (labelScaler.scale(_labelFontSize) - _labelFontSize);
    return ColoredBox(
      // Solid backdrop behind the floating capsule so no content can bleed
      // through. The capsule itself stays styled; only the transparency goes.
      color: AppColors.bgDeepest,
      child: Padding(
        padding: EdgeInsets.fromLTRB(14, 0, 14, 12 + mq.padding.bottom),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(outerHeight / 2),
          child: Container(
            height: outerHeight,
            decoration: BoxDecoration(
              // Outer capsule: fully opaque deep navy.
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B1422), Color(0xFF050A14)],
              ),
              borderRadius: BorderRadius.circular(outerHeight / 2),
              border: Border.all(
                color: AppColors.accentPrimary.withValues(alpha: 0.18),
                width: 1,
              ),
              boxShadow: [
                // Ambient drop shadow.
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.55),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
                // Faint accent glow under the bar.
                BoxShadow(
                  color: AppColors.accentPrimary.withValues(alpha: 0.14),
                  blurRadius: 24,
                  spreadRadius: -6,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: LayoutBuilder(
              builder: (context, c) {
                final innerWidth = c.maxWidth - 2 * _innerInset;
                final cellWidth = innerWidth / items.length;
                final pillHeight = outerHeight - 2 * _innerInset;
                return Stack(
                  children: [
                    // Sliding glass-on-glass selection pill.
                    AnimatedPositioned(
                      duration: _slide,
                      curve: _slideCurve,
                      left: _innerInset + currentIndex * cellWidth,
                      top: _innerInset,
                      width: cellWidth,
                      height: pillHeight,
                      child: const IgnorePointer(child: _SelectedPill()),
                    ),
                    // Tab cells. Positioned.fill forces the row to use the
                    // full capsule height so each cell can vertically center
                    // its icon + label.
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: _innerInset,
                        ),
                        child: Row(
                          children: [
                            for (var i = 0; i < items.length; i++)
                              Expanded(
                                child: _TabCell(
                                  item: items[i],
                                  selected: currentIndex == i,
                                  labelScaler: labelScaler,
                                  onTap: () => onTap(i),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Second-layer glass behind the active tab. Brighter frosted fill, accent
/// border + inner highlight, soft cyan glow, and an extra blur pass on top
/// of whatever the outer capsule already blurred.
class _SelectedPill extends StatelessWidget {
  const _SelectedPill();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.18),
                AppColors.accentPrimary.withValues(alpha: 0.16),
              ],
            ),
            border: Border.all(
              color: AppColors.accentPrimary.withValues(alpha: 0.55),
              width: 1,
            ),
            boxShadow: [
              // Outer cyan glow.
              BoxShadow(
                color: AppColors.accentPrimary.withValues(alpha: 0.45),
                blurRadius: 18,
                spreadRadius: -2,
              ),
              // Inner top highlight (faked with an offset white shadow).
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.10),
                blurRadius: 6,
                offset: const Offset(0, -1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabCell extends StatelessWidget {
  const _TabCell({
    required this.item,
    required this.selected,
    required this.labelScaler,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final TextScaler labelScaler;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      // One merged button node instead of also announcing the inner label Text.
      excludeSemantics: true,
      child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: TweenAnimationBuilder<double>(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
        tween: Tween(begin: 0, end: selected ? 1 : 0),
        builder: (context, t, _) {
          final color = Color.lerp(
            const Color(0xFF8AA4C2), // dim
            AppColors.accentPrimary, // active
            t,
          )!;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  selected ? item.selectedIcon : item.icon,
                  color: color,
                  size: 22,
                  shadows: selected
                      ? [
                          Shadow(
                            color:
                                AppColors.accentPrimary.withValues(alpha: 0.6),
                            blurRadius: 8,
                          ),
                        ]
                      : const [],
                ),
                const SizedBox(height: 3),
                // F69: honour the user's text-size setting (clamped upstream)
                // instead of FittedBox(scaleDown), which discarded it. Ellipsis
                // is the horizontal safety valve for the longest label at max
                // scale on the narrowest phones.
                Text(
                  item.label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  textScaler: labelScaler,
                  style: TextStyle(
                    color: color,
                    fontSize: _UnderdeckTabBar._labelFontSize,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          );
        },
      ),
      ),
    );
  }
}
