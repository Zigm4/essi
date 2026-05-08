import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/haptics.dart';
import '../colors.dart';
import '../spacing.dart';

class PageScrollView extends ConsumerStatefulWidget {
  const PageScrollView({
    super.key,
    required this.child,
    this.padding,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  ConsumerState<PageScrollView> createState() => _PageScrollViewState();
}

class _PageScrollViewState extends ConsumerState<PageScrollView> {
  final _ctrl = ScrollController();
  bool _showButton = false;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    final visible = _ctrl.offset > 100;
    if (visible != _showButton) setState(() => _showButton = visible);
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
    return Stack(
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
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: FadeTransition(opacity: anim, child: child)),
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
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accentPrimary.withValues(alpha: 0.4),
                            blurRadius: 8,
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
    );
  }
}
