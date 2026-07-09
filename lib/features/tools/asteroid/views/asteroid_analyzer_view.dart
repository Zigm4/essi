import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/neon_button.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/terminal_notes.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../domain/asteroid_models.dart';

class AsteroidAnalyzerView extends ConsumerStatefulWidget {
  const AsteroidAnalyzerView({super.key});

  @override
  ConsumerState<AsteroidAnalyzerView> createState() =>
      _AsteroidAnalyzerViewState();
}

class _AsteroidAnalyzerViewState extends ConsumerState<AsteroidAnalyzerView> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  AsteroidAnalysis? _analysis;
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    final cleaned = v.replaceAll(RegExp(r'[^0-9]'), '');
    final clipped = cleaned.length > 9 ? cleaned.substring(0, 9) : cleaned;
    if (clipped != v) {
      _ctrl.value = TextEditingValue(
        text: clipped,
        selection: TextSelection.collapsed(offset: clipped.length),
      );
    }
    if (_analysis != null || _error != null) {
      setState(() {
        _analysis = null;
        _error = null;
      });
    } else {
      setState(() {});
    }
  }

  void _analyze(AsteroidTables tables) {
    _focus.unfocus();
    try {
      final result = AsteroidDecoder.analyze(_ctrl.text, tables);
      Haptics.of(ref).success();
      setState(() {
        _analysis = result;
        _error = null;
      });
    } on AsteroidDecodeException catch (e) {
      Haptics.of(ref).error();
      setState(() {
        _analysis = null;
        _error = e.message;
      });
    } catch (_) {
      setState(() {
        _analysis = null;
        _error = 'Unknown error.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tablesAsync = ref.watch(asteroidTablesProvider);
    final raw = _ctrl.text;
    final rules = AsteroidDecoder.validationRules(raw);
    final canAnalyze = rules.every((r) => r.isSatisfied);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Asteroid Analyzer', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: tablesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              'Failed to load tables: $e',
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (tables) => PageScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              MediaQuery.paddingOf(context).top +
                  kToolbarHeight +
                  AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const TransmissionHeader(
                  label: 'ESSI · Asteroid Analysis Division',
                ),
                const SizedBox(height: AppSpacing.lg),
                const _UfoContextNote(),
                const SizedBox(height: AppSpacing.lg),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Enter a 9-digit asteroid ID',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        controller: _ctrl,
                        focusNode: _focus,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(9),
                        ],
                        decoration: InputDecoration(
                          hintText: 'e.g. 195016321',
                          hintStyle: AppTypography.mono.copyWith(
                            fontSize: 24,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textDim,
                          ),
                          border: UnderlineInputBorder(
                            borderSide: BorderSide(
                              color: canAnalyze
                                  ? AppColors.accentSuccess
                                  : AppColors.borderGlow,
                            ),
                          ),
                          enabledBorder: UnderlineInputBorder(
                            borderSide: BorderSide(
                              color: canAnalyze
                                  ? AppColors.accentSuccess
                                  : AppColors.borderGlow,
                            ),
                          ),
                          focusedBorder: UnderlineInputBorder(
                            borderSide: BorderSide(
                              color: canAnalyze
                                  ? AppColors.accentSuccess
                                  : AppColors.borderGlow,
                              width: 2,
                            ),
                          ),
                          isDense: true,
                        ),
                        style: AppTypography.mono.copyWith(
                          fontSize: 26,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        onChanged: _onChanged,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      NeonButton(
                        title: 'Analyze',
                        icon: Icons.graphic_eq,
                        enabled: canAnalyze,
                        onPressed: () => _analyze(tables),
                      ),
                    ],
                  ),
                ),
                if (raw.isNotEmpty && !canAnalyze) ...[
                  const SizedBox(height: AppSpacing.lg),
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'ID format',
                          icon: Icons.checklist,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (final r in rules) _ValidationRow(rule: r),
                      ],
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  GlassCard(
                    child: Row(
                      children: [
                        const Icon(Icons.warning,
                            color: AppColors.accentDanger),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(_error!, style: AppTypography.body),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_analysis != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  _ReportView(analysis: _analysis!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ValidationRow extends StatelessWidget {
  const _ValidationRow({required this.rule});
  final AsteroidValidationRule rule;

  @override
  Widget build(BuildContext context) {
    final color =
        rule.isSatisfied ? AppColors.accentSuccess : AppColors.accentDanger;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            rule.isSatisfied ? Icons.check_circle : Icons.cancel,
            color: color,
            size: 16,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              rule.label,
              style: AppTypography.body.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: rule.isSatisfied
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportView extends StatelessWidget {
  const _ReportView({required this.analysis});
  final AsteroidAnalysis analysis;

  String _fmt(double v) {
    if (v % 1 == 0) return v.toStringAsFixed(0);
    return v.toStringAsFixed(1);
  }

  Color _alertTint(AsteroidAlertLevel l) {
    switch (l) {
      case AsteroidAlertLevel.info:
        return AppColors.accentPrimary;
      case AsteroidAlertLevel.warning:
      case AsteroidAlertLevel.high:
        return AppColors.accentWarn;
      case AsteroidAlertLevel.critical:
        return AppColors.accentDanger;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '> decoding asteroid ${analysis.id}…',
          style: AppTypography.terminal,
        ),
        const SizedBox(height: 2),
        Text('> match found ✓', style: AppTypography.terminal),
        const SizedBox(height: AppSpacing.lg),
        for (final a in analysis.alerts) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: _alertTint(a.level).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(
                color: _alertTint(a.level).withValues(alpha: 0.5),
                width: 1,
              ),
            ),
            child: Row(
              children: [
                Text(a.emoji, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(a.message, style: AppTypography.body)),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (analysis.alerts.isNotEmpty) const SizedBox(height: AppSpacing.sm),
        GlassCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Wealth', style: AppTypography.caption),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        for (var i = 0; i < 9; i++) ...[
                          Icon(
                            i < analysis.wealth
                                ? Icons.attach_money
                                : Icons.money_off,
                            size: 18,
                            color: i < analysis.wealth
                                ? AppColors.accentWarn
                                : AppColors.textDim,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${analysis.wealth}/9', style: AppTypography.caption),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Resource value', style: AppTypography.caption),
                  const SizedBox(height: 4),
                  Text(
                    _fmt(analysis.resourceValue),
                    style: AppTypography.mono.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: AppColors.accentSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Primary characteristics'),
              const SizedBox(height: AppSpacing.sm),
              _InfoRow(label: 'Type', entry: analysis.type),
              _InfoRow(
                label: 'Size',
                entry: analysis.size,
                suffix: analysis.size.multiplier == null
                    ? null
                    : '×${_fmt(analysis.size.multiplier!)}',
              ),
              _InfoRow(
                label: 'Structure',
                entry: analysis.structure,
                suffix: analysis.structure.risk == null
                    ? null
                    : 'risk ${analysis.structure.risk}',
              ),
              _InfoRow(
                label: 'Salvage',
                entry: analysis.salvage,
                suffix: analysis.salvage.value == null
                    ? null
                    : 'value ${analysis.salvage.value}',
              ),
              _InfoRow(label: 'Law', entry: analysis.law),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Resources'),
              const SizedBox(height: AppSpacing.sm),
              for (final r in analysis.resources)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Text(r.entry.emoji,
                          style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.entry.name, style: AppTypography.body),
                            if (r.entry.symbol != null)
                              Text(
                                r.entry.symbol!,
                                style: AppTypography.mono.copyWith(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Text(
                        '${r.entry.value ?? 0} pts',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.entry, this.suffix});
  final String label;
  final AsteroidEntry entry;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 80, child: Text(label, style: AppTypography.caption)),
          Text(entry.emoji, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(entry.name, style: AppTypography.body)),
          if (suffix != null)
            Text(suffix!, style: AppTypography.caption),
        ],
      ),
    );
  }
}

/// Terminal-style context note explaining who this tool is for. Mirrors the
/// `_HangarNotesCard` look (`> tool.notes` header + indexed lines + blinking
/// cursor for "more notes pending").
class _UfoContextNote extends StatelessWidget {
  const _UfoContextNote();

  @override
  Widget build(BuildContext context) {
    return const TerminalNotes(
      title: 'asteroid.notes',
      lines: [
        'This tool is for players who own a UFO, the type of ship that can mine multiple resources directly from asteroids.',
        "Some players own several UFOs, you can ask them to grant you pilot rights if you want to try the gameplay.",
        "Decomposing an asteroid's ID reveals its quality: resource composition, hazard level, size and other key characteristics.",
      ],
    );
  }
}
