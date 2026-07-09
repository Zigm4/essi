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
class PageScrollView extends ConsumerStatefulWidget {
  const PageScrollView({
    super.key,
    required this.child,
    this.padding,
    this.controller,
  });

  final Widget child;
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
    return ScrollOffsetScope(
      offset: _offset,
      child: Stack(
        children: [
          ListView(
            controller: _ctrl,
            padding: widget.padding ?? EdgeInsets.zero,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [widget.child],
          ),
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
