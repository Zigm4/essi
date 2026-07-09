import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../data/jobs_repository.dart';
import '../domain/job_filter.dart';
import '../domain/job_taxonomies.dart';
import '../state/jobs_controller.dart';

/// Slide-up sheet that collects every secondary filter. Edits a draft copy
/// of [JobFilter]; the live result count is shown at the bottom and the
/// changes are committed when the user taps "Apply".
class JobsFilterSheet extends ConsumerStatefulWidget {
  const JobsFilterSheet({
    super.key,
    required this.allTypes,
    required this.allRewards,
    required this.allSkills,
    required this.typeCounts,
    required this.rewardCounts,
    required this.skillCounts,
  });

  final List<String> allTypes; // sorted, canonical
  final List<String> allRewards;
  final List<String> allSkills;

  /// Number of matching jobs per filter key, so chips can render `Label · N`
  /// and never look "empty" even when the dataset only has 1 job for them.
  final Map<String, int> typeCounts;
  final Map<String, int> rewardCounts;
  final Map<String, int> skillCounts;

  @override
  ConsumerState<JobsFilterSheet> createState() => _JobsFilterSheetState();
}

class _JobsFilterSheetState extends ConsumerState<JobsFilterSheet> {
  late JobFilter _draft;
  late final TextEditingController _pickupAstCtrl;
  late final TextEditingController _pickupZoneCtrl;
  late final TextEditingController _dropoffAstCtrl;
  late final TextEditingController _dropoffZoneCtrl;

  @override
  void initState() {
    super.initState();
    _draft = ref.read(jobFilterControllerProvider);
    _pickupAstCtrl =
        TextEditingController(text: _draft.pickupAstnum?.toString() ?? '');
    _pickupZoneCtrl =
        TextEditingController(text: _draft.pickupZone?.toString() ?? '');
    _dropoffAstCtrl =
        TextEditingController(text: _draft.dropoffAstnum?.toString() ?? '');
    _dropoffZoneCtrl =
        TextEditingController(text: _draft.dropoffZone?.toString() ?? '');
  }

  @override
  void dispose() {
    _pickupAstCtrl.dispose();
    _pickupZoneCtrl.dispose();
    _dropoffAstCtrl.dispose();
    _dropoffZoneCtrl.dispose();
    super.dispose();
  }

  int _liveResultCount() {
    final repo = ref.read(jobsRepositoryProvider).maybeWhen(
          data: (r) => r,
          orElse: () => null,
        );
    if (repo == null) return 0;
    final draft = _commitFiltersFromText();
    return repo.all.where(draft.accepts).length;
  }

  /// Builds a draft including the un-committed text inputs so the live count
  /// reflects what the user is currently typing.
  JobFilter _commitFiltersFromText() {
    int? parseInt(String s) {
      final t = s.trim();
      if (t.isEmpty) return null;
      return int.tryParse(t);
    }

    return _draft.copyWith(
      pickupAstnum: parseInt(_pickupAstCtrl.text),
      clearPickupAstnum: parseInt(_pickupAstCtrl.text) == null,
      pickupZone: parseInt(_pickupZoneCtrl.text),
      clearPickupZone: parseInt(_pickupZoneCtrl.text) == null,
      dropoffAstnum: parseInt(_dropoffAstCtrl.text),
      clearDropoffAstnum: parseInt(_dropoffAstCtrl.text) == null,
      dropoffZone: parseInt(_dropoffZoneCtrl.text),
      clearDropoffZone: parseInt(_dropoffZoneCtrl.text) == null,
    );
  }

  void _apply() {
    Haptics.of(ref).tap();
    ref.read(jobFilterControllerProvider.notifier).update(
          (_) => _commitFiltersFromText(),
        );
    Navigator.of(context).pop();
  }

  void _reset() {
    Haptics.of(ref).warning();
    setState(() {
      _draft = JobFilter.empty;
      _pickupAstCtrl.clear();
      _pickupZoneCtrl.clear();
      _dropoffAstCtrl.clear();
      _dropoffZoneCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, controller) {
        return ClipRRect(
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
          child: Container(
            color: AppColors.bgElevated,
            child: Column(
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.textDim,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.sm,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Text('Filters', style: AppTypography.headline),
                      const Spacer(),
                      TextButton(
                        onPressed: _reset,
                        child: const Text(
                          'Reset',
                          style: TextStyle(color: AppColors.accentDanger),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: controller,
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      0,
                      AppSpacing.lg,
                      AppSpacing.xxl,
                    ),
                    children: [
                      _section(
                        title: 'Type',
                        child: _TypeChips(
                          all: widget.allTypes,
                          selected: _draft.types,
                          countFor: (k) => widget.typeCounts[k] ?? 0,
                          onChange: (s) =>
                              setState(() => _draft = _draft.copyWith(types: s)),
                        ),
                      ),
                      _section(
                        title: 'Allied faction',
                        child: _FactionChips(
                          options: JobTaxonomies.alliedFactions,
                          selected: _draft.alliedFactions,
                          onChange: (s) => setState(() =>
                              _draft = _draft.copyWith(alliedFactions: s)),
                        ),
                      ),
                      _section(
                        title: 'Rival faction',
                        child: _FactionChips(
                          options: [
                            ...JobTaxonomies.alliedFactions,
                            ...JobTaxonomies.rivalOnlyFactions,
                          ],
                          selected: _draft.rivalFactions,
                          onChange: (s) => setState(
                              () => _draft = _draft.copyWith(rivalFactions: s)),
                        ),
                      ),
                      _section(
                        title: 'Reward',
                        child: _KeyedChips(
                          all: widget.allRewards,
                          selected: _draft.rewards,
                          labelFor: JobTaxonomies.rewardLabel,
                          tintFor: JobTaxonomies.rewardTint,
                          countFor: (k) => widget.rewardCounts[k] ?? 0,
                          onChange: (s) => setState(
                              () => _draft = _draft.copyWith(rewards: s)),
                        ),
                      ),
                      _section(
                        title: 'Bonus',
                        child: _RangeBlock(
                          range: _draft.bonus,
                          min: 0,
                          max: 500,
                          divisions: 50,
                          onChange: (r) => setState(
                              () => _draft = _draft.copyWith(bonus: r)),
                        ),
                      ),
                      _section(
                        title: 'Required skill',
                        child: _KeyedChips(
                          all: widget.allSkills,
                          selected: _draft.skills,
                          labelFor: (k) => k,
                          tintFor: (k) =>
                              JobTaxonomies.skills[k] ??
                              AppColors.accentSecondary,
                          countFor: (k) => widget.skillCounts[k] ?? 0,
                          onChange: (s) => setState(
                              () => _draft = _draft.copyWith(skills: s)),
                        ),
                      ),
                      _section(
                        title: 'Skill amount required',
                        child: _RangeBlock(
                          range: _draft.skillAmt,
                          min: 0,
                          max: 100,
                          divisions: 20,
                          onChange: (r) => setState(
                              () => _draft = _draft.copyWith(skillAmt: r)),
                        ),
                      ),
                      _section(
                        title: 'Required reputation',
                        child: _RangeBlock(
                          range: _draft.requiredRep,
                          min: 0,
                          max: 8,
                          divisions: 8,
                          onChange: (r) => setState(
                              () => _draft = _draft.copyWith(requiredRep: r)),
                        ),
                      ),
                      _section(
                        title: 'Required tag',
                        child: _TagChips(
                          selected: _draft.tags,
                          onChange: (s) =>
                              setState(() => _draft = _draft.copyWith(tags: s)),
                        ),
                      ),
                      _section(
                        title: 'Risk',
                        child: _RangeBlock(
                          range: _draft.risk,
                          min: 0,
                          max: 14,
                          divisions: 14,
                          onChange: (r) =>
                              setState(() => _draft = _draft.copyWith(risk: r)),
                        ),
                      ),
                      _section(
                        title: 'Location',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _LocationInputs(
                              prefix: 'Pickup',
                              astCtrl: _pickupAstCtrl,
                              zoneCtrl: _pickupZoneCtrl,
                              onChanged: () => setState(() {}),
                            ),
                            const SizedBox(height: 8),
                            _LocationInputs(
                              prefix: 'Dropoff',
                              astCtrl: _dropoffAstCtrl,
                              zoneCtrl: _dropoffZoneCtrl,
                              onChanged: () => setState(() {}),
                            ),
                            const SizedBox(height: 6),
                            _ToggleRow(
                              label: 'On-site only (pickup = dropoff)',
                              value: _draft.onSiteOnly,
                              onChange: (v) => setState(
                                  () => _draft = _draft.copyWith(onSiteOnly: v)),
                            ),
                          ],
                        ),
                      ),
                      _section(
                        title: 'More',
                        child: Column(
                          children: [
                            _ToggleRow(
                              label: 'Cargo jobs only',
                              value: _draft.cargoJobsOnly,
                              onChange: (v) => setState(() =>
                                  _draft = _draft.copyWith(cargoJobsOnly: v)),
                            ),
                            _ToggleRow(
                              label: 'Has rival impact',
                              value: _draft.rivalImpactOnly,
                              onChange: (v) => setState(() =>
                                  _draft = _draft.copyWith(rivalImpactOnly: v)),
                            ),
                            _ToggleRow(
                              label: 'Hide “???” type',
                              value: _draft.hidePlaceholder,
                              onChange: (v) => setState(() =>
                                  _draft = _draft.copyWith(hidePlaceholder: v)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                _Footer(
                  count: _liveResultCount(),
                  onApply: _apply,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _section({required String title, required Widget child}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
              color: AppColors.accentPrimary,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.count, required this.onApply});
  final int count;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgDeepest.withValues(alpha: 0.92),
          border: Border(
            top: BorderSide(color: AppColors.borderSubtle, width: 1),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          AppSpacing.sm,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '$count result${count == 1 ? '' : 's'}',
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            FilledButton(
              onPressed: onApply,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.accentPrimary,
                foregroundColor: AppColors.bgDeepest,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 10,
                ),
              ),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeChips extends StatelessWidget {
  const _TypeChips({
    required this.all,
    required this.selected,
    required this.onChange,
    this.countFor,
  });
  final List<String> all;
  final Set<String> selected;
  final ValueChanged<Set<String>> onChange;
  final int Function(String)? countFor;

  @override
  Widget build(BuildContext context) {
    // Group by bucket for readability.
    final byBucket = <String, List<String>>{};
    for (final t in all) {
      final b = JobTaxonomies.bucketFor(t);
      byBucket.putIfAbsent(b, () => []).add(t);
    }
    final entries = byBucket.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in entries) ...[
          Text(
            entry.key,
            style: AppTypography.caption.copyWith(
              fontSize: 11,
              color: AppColors.textDim,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final t in entry.value)
                _Pill(
                  label: t,
                  count: countFor?.call(t),
                  selected: selected.contains(t),
                  tint: AppColors.accentPrimary,
                  onTap: () {
                    final next = Set<String>.from(selected);
                    if (!next.add(t)) next.remove(t);
                    onChange(next);
                  },
                ),
            ],
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _FactionChips extends StatelessWidget {
  const _FactionChips({
    required this.options,
    required this.selected,
    required this.onChange,
  });

  final List<FactionInfo> options;
  final Set<String> selected;
  final ValueChanged<Set<String>> onChange;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final f in options)
          _Pill(
            label: f.label,
            selected: selected.contains(f.key),
            tint: f.tint,
            onTap: () {
              final next = Set<String>.from(selected);
              if (!next.add(f.key)) next.remove(f.key);
              onChange(next);
            },
          ),
      ],
    );
  }
}

class _KeyedChips extends StatelessWidget {
  const _KeyedChips({
    required this.all,
    required this.selected,
    required this.labelFor,
    required this.tintFor,
    required this.onChange,
    this.countFor,
  });

  final List<String> all;
  final Set<String> selected;
  final String Function(String) labelFor;
  final Color Function(String) tintFor;
  final ValueChanged<Set<String>> onChange;
  final int Function(String)? countFor;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final k in all)
          _Pill(
            label: labelFor(k),
            count: countFor?.call(k),
            selected: selected.contains(k),
            tint: tintFor(k),
            onTap: () {
              final next = Set<String>.from(selected);
              if (!next.add(k)) next.remove(k);
              onChange(next);
            },
          ),
      ],
    );
  }
}

class _TagChips extends StatelessWidget {
  const _TagChips({required this.selected, required this.onChange});
  final Set<String> selected;
  final ValueChanged<Set<String>> onChange;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final entry in JobTaxonomies.tags.entries)
          _Pill(
            label: entry.value,
            selected: selected.contains(entry.key),
            tint: AppColors.accentSuccess,
            onTap: () {
              final next = Set<String>.from(selected);
              if (!next.add(entry.key)) next.remove(entry.key);
              onChange(next);
            },
          ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.tint,
    required this.onTap,
    this.count,
  });

  final String label;
  final bool selected;
  final Color tint;
  final VoidCallback onTap;

  /// Optional job count rendered as a dimmed `· N` suffix. Lets the user
  /// see at a glance how many jobs match the option, so a rare reward (e.g.
  /// a single Wackos job) isn't mistaken for an empty filter.
  final int? count;

  @override
  Widget build(BuildContext context) {
    final dim = count != null && count == 0;
    return GestureDetector(
      onTap: dim ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? tint.withValues(alpha: 0.18)
              : AppColors.bgGlass,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected
                ? tint.withValues(alpha: 0.8)
                : AppColors.borderSubtle,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected
                    ? tint
                    : (dim ? AppColors.textDim : AppColors.textSecondary),
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 5),
              Text(
                '· $count',
                style: AppTypography.mono.copyWith(
                  fontSize: 10,
                  color: AppColors.textDim,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RangeBlock extends StatelessWidget {
  const _RangeBlock({
    required this.range,
    required this.min,
    required this.max,
    required this.divisions,
    required this.onChange,
  });

  final RangeValues range;
  final double min;
  final double max;
  final int divisions;
  final ValueChanged<RangeValues> onChange;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${range.start.round()} – ${range.end.round()}',
          style: AppTypography.mono.copyWith(
            fontSize: 11,
            color: AppColors.accentSecondary,
          ),
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: AppColors.accentPrimary,
            inactiveTrackColor:
                AppColors.accentPrimary.withValues(alpha: 0.18),
            thumbColor: AppColors.accentPrimary,
            overlayColor: AppColors.accentPrimary.withValues(alpha: 0.2),
            valueIndicatorColor: AppColors.bgElevated,
            trackHeight: 3,
          ),
          child: RangeSlider(
            values: range,
            min: min,
            max: max,
            divisions: divisions,
            labels: RangeLabels(
              range.start.round().toString(),
              range.end.round().toString(),
            ),
            onChanged: onChange,
          ),
        ),
      ],
    );
  }
}

class _LocationInputs extends StatelessWidget {
  const _LocationInputs({
    required this.prefix,
    required this.astCtrl,
    required this.zoneCtrl,
    required this.onChanged,
  });

  final String prefix;
  final TextEditingController astCtrl;
  final TextEditingController zoneCtrl;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    InputDecoration deco(String hint) => InputDecoration(
          isDense: true,
          hintText: hint,
          hintStyle: AppTypography.mono.copyWith(
            fontSize: 11,
            color: AppColors.textDim,
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            borderSide: BorderSide(color: AppColors.borderSubtle),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            borderSide: const BorderSide(color: AppColors.accentPrimary),
          ),
        );
    return Row(
      children: [
        SizedBox(
          width: 64,
          child: Text(
            prefix,
            style: AppTypography.caption.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: TextField(
            controller: astCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => onChanged(),
            style: AppTypography.mono.copyWith(fontSize: 12),
            decoration: deco('astnum'),
          ),
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 90,
          child: TextField(
            controller: zoneCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => onChanged(),
            style: AppTypography.mono.copyWith(fontSize: 12),
            decoration: deco('zone'),
          ),
        ),
      ],
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.label,
    required this.value,
    required this.onChange,
  });
  final String label;
  final bool value;
  final ValueChanged<bool> onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppTypography.body)),
          Switch(
            value: value,
            onChanged: onChange,
            activeThumbColor: AppColors.accentSuccess,
          ),
        ],
      ),
    );
  }
}
