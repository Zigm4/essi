import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/app_settings.dart';
import '../typography.dart';

class BootTerminalText extends ConsumerStatefulWidget {
  const BootTerminalText({
    super.key,
    required this.lines,
    this.charDelay = const Duration(microseconds: 18000),
    this.lineDelay = const Duration(milliseconds: 180),
    this.visibleLines = 4,
    this.lineHeight = 18,
    this.lineSpacing = 4,
    this.onComplete,
  });

  final List<String> lines;
  final Duration charDelay;
  final Duration lineDelay;
  final int visibleLines;
  final double lineHeight;
  final double lineSpacing;
  final VoidCallback? onComplete;

  @override
  ConsumerState<BootTerminalText> createState() => _BootTerminalTextState();
}

class _BootTerminalTextState extends ConsumerState<BootTerminalText>
    with SingleTickerProviderStateMixin {
  final List<String> _rendered = [];
  final ScrollController _scroll = ScrollController();

  late final AnimationController _cursorCtrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  )..repeat(reverse: true);

  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _play();
    }
  }

  @override
  void dispose() {
    _cursorCtrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  bool _shouldSkip() {
    final reduce = ref.read(appSettingsProvider).reduceAnimations;
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    return reduce || mqReduce;
  }

  Future<void> _play() async {
    if (_shouldSkip()) {
      setState(() => _rendered
        ..clear()
        ..addAll(widget.lines));
      widget.onComplete?.call();
      return;
    }
    setState(() => _rendered
      ..clear()
      ..add(''));
    for (final line in widget.lines) {
      for (final ch in line.characters) {
        if (!mounted) return;
        setState(() {
          _rendered[_rendered.length - 1] = _rendered.last + ch;
        });
        await _scrollToBottom();
        await Future<void>.delayed(widget.charDelay);
      }
      if (!mounted) return;
      await Future<void>.delayed(widget.lineDelay);
      setState(() => _rendered.add(''));
      await _scrollToBottom();
    }
    widget.onComplete?.call();
  }

  Future<void> _scrollToBottom() async {
    if (!_scroll.hasClients) return;
    await _scroll.animateTo(
      _scroll.position.maxScrollExtent,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final containerHeight = widget.visibleLines * widget.lineHeight +
        (widget.visibleLines - 1).clamp(0, double.infinity) * widget.lineSpacing;
    final skip = _shouldSkip();
    return SizedBox(
      width: double.infinity,
      height: containerHeight,
      child: ClipRect(
        child: SingleChildScrollView(
          controller: _scroll,
          physics: const NeverScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < _rendered.length; i++)
                Padding(
                  padding: EdgeInsets.only(
                    bottom: i == _rendered.length - 1 ? 0 : widget.lineSpacing,
                  ),
                  child: SizedBox(
                    height: widget.lineHeight,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(_rendered[i], style: AppTypography.terminal),
                        if (!skip &&
                            i == _rendered.length - 1 &&
                            _rendered.length < widget.lines.length + 1)
                          AnimatedBuilder(
                            animation: _cursorCtrl,
                            builder: (context, _) => Opacity(
                              opacity: _cursorCtrl.value,
                              child: Text('▋', style: AppTypography.terminal),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
