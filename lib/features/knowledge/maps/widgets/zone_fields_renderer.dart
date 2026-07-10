import 'package:flutter/material.dart';

import '../../../../core/external_link.dart';
import '../../../../design_system/components/neon_button.dart' show NeonButton;
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../domain/map_enums.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import 'map_theme_scope.dart';

/// Renders a zone's field values, driven entirely by the map's `fieldsSchema`
/// (order + type + style come from content, never hard-coded). Reads the active
/// [MapTheme] from [MapThemeScope].
///
/// Type → presentation:
/// - `enum`      → tinted badge (theme.accent).
/// - `number`    → monospaced value + unit.
/// - `stringList`→ bulleted list.
/// - `longText`  → paragraph.
/// - `text`      → single line.
/// - `link`      → button that opens the URL via the allow-listed launcher.
/// - `unknown`   → plain scalar text, or nothing if the value isn't scalar
///   ("must-ignore": a future field type degrades, never crashes).
///
/// A field with no value in [fields] is skipped.
class ZoneFieldsRenderer extends StatelessWidget {
  const ZoneFieldsRenderer({
    super.key,
    required this.fieldsSchema,
    required this.fields,
  });

  final List<ZoneFieldSpec> fieldsSchema;
  final Map<String, dynamic> fields;

  @override
  Widget build(BuildContext context) {
    final theme = MapThemeScope.of(context);
    final blocks = <Widget>[];
    for (final spec in fieldsSchema) {
      if (!fields.containsKey(spec.key)) continue;
      final value = _buildValue(context, theme, spec, fields[spec.key]);
      if (value == null) continue;
      if (blocks.isNotEmpty) {
        blocks.add(const SizedBox(height: AppSpacing.lg));
      }
      blocks.add(_FieldBlock(label: spec.label, theme: theme, child: value));
    }
    if (blocks.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: blocks,
    );
  }

  Widget? _buildValue(
    BuildContext context,
    MapTheme theme,
    ZoneFieldSpec spec,
    Object? raw,
  ) {
    switch (spec.type) {
      case ZoneFieldType.enumeration:
        final s = _scalar(raw);
        return s == null ? null : _Badge(label: s, theme: theme);
      case ZoneFieldType.number:
        final s = _scalar(raw);
        if (s == null) return null;
        final unit = spec.unit;
        return Text(
          unit == null ? s : '$s $unit',
          style: AppTypography.mono.copyWith(color: theme.label),
        );
      case ZoneFieldType.stringList:
        final items = _stringList(raw);
        if (items.isEmpty) return null;
        return _BulletList(items: items, theme: theme);
      case ZoneFieldType.longText:
        final s = _scalar(raw);
        return s == null
            ? null
            : Text(
                s,
                style: AppTypography.body
                    .copyWith(color: theme.label, height: 1.4),
              );
      case ZoneFieldType.text:
        final s = _scalar(raw);
        return s == null
            ? null
            : Text(s, style: AppTypography.body.copyWith(color: theme.label));
      case ZoneFieldType.link:
        final s = _scalar(raw);
        if (s == null || s.isEmpty) return null;
        return Align(
          alignment: Alignment.centerLeft,
          child: NeonButton(
            title: spec.label,
            icon: Icons.open_in_new_rounded,
            onPressed: () => launchExternal(context, s),
          ),
        );
      case ZoneFieldType.unknown:
        // Must-ignore: show a scalar as-is, drop anything structured.
        final s = _scalar(raw);
        return s == null
            ? null
            : Text(s, style: AppTypography.body.copyWith(color: theme.label));
    }
  }
}

/// A label + value pair.
class _FieldBlock extends StatelessWidget {
  const _FieldBlock({
    required this.label,
    required this.theme,
    required this.child,
  });

  final String label;
  final MapTheme theme;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: AppTypography.caption.copyWith(
            color: theme.label.withValues(alpha: 0.55),
            letterSpacing: 1.1,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        child,
      ],
    );
  }
}

/// A tinted enum badge (mirrors [TagChip] styling but themed per map).
class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.theme});

  final String label;
  final MapTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: theme.accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.accent.withValues(alpha: 0.5), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: theme.fontFamily,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: theme.accent,
          decoration: TextDecoration.none,
        ),
      ),
    );
  }
}

class _BulletList extends StatelessWidget {
  const _BulletList({required this.items, required this.theme});

  final List<String> items;
  final MapTheme theme;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6, right: AppSpacing.sm),
                  child: Container(
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: theme.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    item,
                    style: AppTypography.body.copyWith(color: theme.label),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Coerces a JSON scalar to a display string, or `null` for null/structured.
String? _scalar(Object? raw) {
  if (raw == null) return null;
  if (raw is String) return raw.isEmpty ? null : raw;
  if (raw is num || raw is bool) return raw.toString();
  return null;
}

List<String> _stringList(Object? raw) {
  if (raw is! List) return const [];
  return [
    for (final e in raw) ?_scalar(e),
  ];
}
