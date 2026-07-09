import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import 'tag_chip.dart';

/// Lets an owning editor flush a half-typed-but-uncommitted tag into the
/// selected set right before saving (F38). Attach one via
/// [TagInputField.controller] and call [commitPending] at the start of `_save`.
class TagInputController {
  VoidCallback? _flush;

  /// Commits whatever token is currently typed in the field, if any.
  void commitPending() => _flush?.call();
}

class TagInputField extends StatefulWidget {
  const TagInputField({
    super.key,
    required this.selectedTags,
    required this.onChanged,
    required this.suggestionPool,
    this.controller,
    this.placeholder = 'Add tag…',
  });

  final List<String> selectedTags;
  final ValueChanged<List<String>> onChanged;
  final List<String> suggestionPool;
  final TagInputController? controller;
  final String placeholder;

  @override
  State<TagInputField> createState() => _TagInputFieldState();
}

class _TagInputFieldState extends State<TagInputField> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    widget.controller?._flush = _commit;
    _focus.addListener(() {
      if (_focus.hasFocus != _focused) {
        setState(() => _focused = _focus.hasFocus);
      }
    });
  }

  @override
  void didUpdateWidget(TagInputField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      if (oldWidget.controller?._flush == _commit) {
        oldWidget.controller?._flush = null;
      }
      widget.controller?._flush = _commit;
    }
  }

  @override
  void dispose() {
    if (widget.controller?._flush == _commit) {
      widget.controller?._flush = null;
    }
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  String get _normalized => _controller.text.trim();

  List<String> get _suggestions {
    final raw = _normalized.toLowerCase();
    if (raw.isEmpty) return const [];
    return widget.suggestionPool
        .where((p) =>
            p.toLowerCase().contains(raw) && !widget.selectedTags.contains(p))
        .take(6)
        .toList();
  }

  void _commit() {
    var s = _normalized.replaceAll(',', '').trim();
    if (s.isEmpty) {
      _controller.clear();
      return;
    }
    _add(s);
    _controller.clear();
  }

  void _add(String tag) {
    final trimmed = tag.trim();
    if (trimmed.isEmpty) return;
    if (widget.selectedTags
        .any((t) => t.toLowerCase() == trimmed.toLowerCase())) {
      return;
    }
    widget.onChanged([...widget.selectedTags, trimmed]);
  }

  void _remove(String tag) {
    widget.onChanged(widget.selectedTags.where((t) => t != tag).toList());
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: AppColors.bgGlass,
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(
              color: _focused
                  ? AppColors.borderGlow
                  : AppColors.borderSubtle,
              width: 1,
            ),
          ),
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final tag in widget.selectedTags)
                TagChip(
                  label: tag,
                  selected: true,
                  onRemove: () => _remove(tag),
                ),
              IntrinsicWidth(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 80),
                  child: TextField(
                    controller: _controller,
                    focusNode: _focus,
                    decoration: InputDecoration(
                      hintText: widget.placeholder,
                      hintStyle: AppTypography.body.copyWith(
                        color: AppColors.textDim,
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                      isDense: true,
                    ),
                    style: AppTypography.body,
                    autocorrect: false,
                    enableSuggestions: false,
                    textInputAction: TextInputAction.done,
                    inputFormatters: [
                      FilteringTextInputFormatter.deny(RegExp(r'[\n]')),
                    ],
                    onChanged: (v) {
                      if (v.contains(',') || v.endsWith(' ')) {
                        _commit();
                      } else {
                        setState(() {});
                      }
                    },
                    onSubmitted: (_) => _commit(),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_suggestions.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final s in _suggestions) ...[
                  TagChip(
                    label: s,
                    onTap: () {
                      _add(s);
                      _controller.clear();
                      setState(() {});
                    },
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
