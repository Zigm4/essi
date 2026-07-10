import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/haptics.dart';
import '../colors.dart';
import '../spacing.dart';

/// Inherited scroll offset broadcaster. Any descendant can subscribe to read
/// the current scroll position of the nearest [PageScrollView]. Used by
/// [TransmissionHeader] to drive its scroll-tied sector counter.
class ScrollOffsetScope extends InheritedNotifier<ValueNotifier<double>> {
  const ScrollOffsetScope({
    super.key,
    required ValueNotifier<double> offset,
    required super.child,
  }) : super(notifier: offset);

  static ValueNotifier<double>? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<ScrollOffsetScope>()
        ?.notifier;
  }
}

/// Drop-in scroll wrapper. Shows a floating back-to-top button once the user
/// has scrolled past one screen height, and broadcasts the current scroll
/// offset to descendants via [ScrollOffsetScope].
///
/// Two flavours share the same back-to-top / offset / controller plumbing:
///  * default constructor — a single [child] in a non-virtualized [ListView];
///    convenient for short pages.
///  * [PageScrollView.slivers] — a [CustomScrollView] driven by caller-provided
///    slivers, so long lists can lazily build their items (e.g. via
///    `SliverList.builder`). Use this on high-item-count pages.
class PageScrollView extends ConsumerStatefulWidget {
  const PageScrollView({
    super.key,
    required Widget this.child,
    this.padding,
    this.controller,
  }) : slivers = null;

  /// Virtualized variant. [slivers] are laid out inside a [CustomScrollView],
  /// so items built with `SliverList.builder` / `SliverGrid.builder` are only
  /// constructed as they scroll into view. [padding] (if any) is applied around
  /// the whole sliver group.
  const PageScrollView.slivers({
    super.key,
    required List<Widget> this.slivers,
    this.padding,
    this.controller,
  }) : child = null;

  /// Single body widget for the non-virtualized default constructor.
  final Widget? child;

  /// Slivers for the [PageScrollView.slivers] variant.
  final List<Widget>? slivers;

  final EdgeInsetsGeometry? padding;
  final ScrollController? controller;

  @override
  ConsumerState<PageScrollView> createState() => _PageScrollViewState();
}

class _PageScrollViewState extends ConsumerState<PageScrollView> {
  late final ScrollController _ctrl;
  late final bool _ownsController;
  final ValueNotifier<double> _offset = ValueNotifier<double>(0);
  bool _showButton = false;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _ctrl = widget.controller ?? ScrollController();
    _ctrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _ctrl.removeListener(_onScroll);
    if (_ownsController) _ctrl.dispose();
    _offset.dispose();
    super.dispose();
  }

  void _onScroll() {
    final off = _ctrl.offset;
    _offset.value = off;
    final screen = MediaQuery.sizeOf(context).height;
    final visible = off > screen;
    if (visible != _showButton) {
      setState(() => _showButton = visible);
    }
  }

  void _scrollToTop() {
    Haptics.of(ref).tap();
    _ctrl.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    // The bottom nav is opaque and `extendBody:false` on AppShell, so the
    // body is naturally bounded above the nav — no extra inset needed here.
    final slivers = widget.slivers;
    final Widget scrollable = slivers == null
        ? ListView(
            controller: _ctrl,
            padding: widget.padding ?? EdgeInsets.zero,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [widget.child!],
          )
        : CustomScrollView(
            controller: _ctrl,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: widget.padding == null
                ? slivers
                : [
                    SliverPadding(
                      padding: widget.padding!,
                      sliver: SliverMainAxisGroup(slivers: slivers),
                    ),
                  ],
          );
    return ScrollOffsetScope(
      offset: _offset,
      child: Stack(
        children: [
          scrollable,
          Positioned(
            right: AppSpacing.lg,
            bottom: AppSpacing.lg,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              transitionBuilder: (child, anim) => ScaleTransition(
                scale: anim,
                child: FadeTransition(opacity: anim, child: child),
              ),
              child: _showButton
                  ? IconButton(
                      key: const ValueKey('scroll-top'),
                      onPressed: _scrollToTop,
                      padding: EdgeInsets.zero,
                      icon: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.bgDeepest,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.accentPrimary
                                .withValues(alpha: 0.6),
                            width: 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accentPrimary
                                  .withValues(alpha: 0.4),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.arrow_upward,
                          color: AppColors.accentPrimary,
                          size: 22,
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }
}
