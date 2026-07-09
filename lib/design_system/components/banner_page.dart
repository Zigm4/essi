import 'package:flutter/material.dart';

import 'transmission_header.dart';

/// Layout for main shell pages: an opaque ESSI banner pinned at the top,
/// the page content scrolling between it and the bottom nav.
///
/// This widget owns the [ScrollController] so the banner's sector code can
/// react to the scroll offset (the value in `ESSI//XXX` changes as you
/// scroll). Pass the controller back via [builder] to give the child scroll
/// view the same one.
class BannerPage extends StatefulWidget {
  const BannerPage({
    super.key,
    required this.bannerLabel,
    this.bannerActions = const [],
    required this.builder,
  });

  /// Banner text on the left, e.g. `ESSI · Operations Bridge`.
  final String bannerLabel;

  /// Trailing icon widgets (typically a `+` action).
  final List<Widget> bannerActions;

  /// Builds the page body. Wire the returned [ScrollController] into your
  /// scrollable widget (PageScrollView, ListView, CustomScrollView, etc).
  final Widget Function(BuildContext, ScrollController) builder;

  @override
  State<BannerPage> createState() => _BannerPageState();
}

class _BannerPageState extends State<BannerPage> {
  final ScrollController _ctrl = ScrollController();
  final ValueNotifier<double> _offset = ValueNotifier<double>(0);

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _ctrl.removeListener(_onScroll);
    _ctrl.dispose();
    _offset.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_ctrl.hasClients) return;
    _offset.value = _ctrl.offset;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          TransmissionHeader(
            label: widget.bannerLabel,
            actions: widget.bannerActions,
            scrollOffset: _offset,
          ),
          Expanded(child: widget.builder(context, _ctrl)),
        ],
      ),
    );
  }
}
