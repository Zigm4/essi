import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../data/jobs_repository.dart';
import '../domain/job.dart';
import '../domain/job_filter.dart';
import '../domain/job_taxonomies.dart';
import '../state/jobs_controller.dart';
import '../widgets/job_card.dart';
import 'job_detail_sheet.dart';
import 'jobs_filter_sheet.dart';

class JobsView extends ConsumerStatefulWidget {
  const JobsView({super.key});

  @override
  ConsumerState<JobsView> createState() => _JobsViewState();
}

class _JobsViewState extends ConsumerState<JobsView> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _searchCtrl.text = ref.read(jobFilterControllerProvider).query;
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _openFilters(List<Job> all) {
    final typeCounts = <String, int>{};
    final rewardCounts = <String, int>{};
    final skillCounts = <String, int>{};
    for (final j in all) {
      typeCounts[j.type] = (typeCounts[j.type] ?? 0) + 1;
      rewardCounts[j.reward] = (rewardCounts[j.reward] ?? 0) + 1;
      final s = j.requiredSkill;
      if (s != null) skillCounts[s] = (skillCounts[s] ?? 0) + 1;
    }
    final types = typeCounts.keys.toList()..sort();
    final rewards = rewardCounts.keys.toList()..sort();
    final skills = skillCounts.keys.toList()..sort();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => JobsFilterSheet(
        allTypes: types,
        allRewards: rewards,
        allSkills: skills,
        typeCounts: typeCounts,
        rewardCounts: rewardCounts,
        skillCounts: skillCounts,
      ),
    );
  }

  void _openDetail(Job j) {
    Haptics.of(ref).tap();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => JobDetailSheet(job: j),
    );
  }

  void _showAboutSheet(BuildContext context) {
    Haptics.of(ref).tap();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _JobsAboutSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(jobFilterControllerProvider);
    final repoAsync = ref.watch(jobsRepositoryProvider);
    final filteredAsync = ref.watch(filteredJobsProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 0,
      ),
      body: AppBackground(
        child: repoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(
                'Error loading jobs: $e',
                style: AppTypography.body
                    .copyWith(color: AppColors.accentDanger),
              ),
            ),
          ),
          data: (repo) {
            return SafeArea(
              child: Column(
                children: [
                  TransmissionHeader(
                    label: 'ESSI · Job Allocation Desk',
                    actions: [
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _showAboutSheet(context),
                        child: const Padding(
                          padding:
                              EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          child: Icon(Icons.info_outline,
                              color: AppColors.accentPrimary, size: 18),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.sm,
                      AppSpacing.sm,
                      AppSpacing.md,
                      AppSpacing.xs,
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => Navigator.of(context).maybePop(),
                          tooltip: 'Back',
                          icon: const Icon(
                            Icons.arrow_back_ios_new,
                            color: AppColors.accentPrimary,
                            size: 20,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          constraints:
                              const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: _SearchField(
                            controller: _searchCtrl,
                            onChanged: (q) => ref
                                .read(jobFilterControllerProvider.notifier)
                                .setQuery(q),
                          ),
                        ),
                        const SizedBox(width: 6),
                        _FilterButton(
                          count: filter.activeCount,
                          onTap: () => _openFilters(repo.all),
                        ),
                        const SizedBox(width: 6),
                        _SortButton(
                          current: filter.sort,
                          onSelected: ref
                              .read(jobFilterControllerProvider.notifier)
                              .setSort,
                        ),
                      ],
                    ),
                  ),
                  _ActiveChipsRow(filter: filter),
                  Expanded(
                    child: filteredAsync.when(
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (e, _) => Center(child: Text('$e')),
                      data: (jobs) {
                        if (jobs.isEmpty) {
                          return _EmptyState(
                            isFiltered: filter.activeCount > 0,
                            onReset: () => ref
                                .read(jobFilterControllerProvider.notifier)
                                .reset(),
                          );
                        }
                        // ListView.builder so only the visible JobCards are
                        // built (the previous Column built all 371 cards
                        // eagerly, which heated the device with shadows
                        // + gradients all painting at once).
                        return ListView.separated(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.xs,
                            AppSpacing.md,
                            AppSpacing.xxl,
                          ),
                          itemCount: jobs.length + 1,
                          separatorBuilder: (_, i) => SizedBox(
                            height: i == 0 ? AppSpacing.sm : AppSpacing.sm,
                          ),
                          itemBuilder: (context, i) {
                            if (i == 0) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                child: Text(
                                  '${jobs.length} job${jobs.length == 1 ? '' : 's'} · sorted by ${filter.sort.label}',
                                  style: AppTypography.mono.copyWith(
                                    fontSize: 11,
                                    color: AppColors.textDim,
                                  ),
                                ),
                              );
                            }
                            final j = jobs[i - 1];
                            return JobCard(
                              job: j,
                              onTap: () => _openDetail(j),
                            );
                          },
                        );
                      },
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

class _SortButton extends StatelessWidget {
  const _SortButton({required this.current, required this.onSelected});
  final JobSort current;
  final ValueChanged<JobSort> onSelected;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<JobSort>(
      tooltip: 'Sort',
      color: AppColors.bgElevated,
      onSelected: onSelected,
      itemBuilder: (_) => [
        for (final s in JobSort.values)
          PopupMenuItem(
            value: s,
            child: Text(
              s.label,
              style: TextStyle(
                color: s == current
                    ? AppColors.accentPrimary
                    : AppColors.textPrimary,
              ),
            ),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: const Icon(
          Icons.sort,
          color: AppColors.accentPrimary,
          size: 18,
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    // Fixed 40pt height with the prefix/suffix icons aligned to centre, and
    // explicit symmetric vertical padding so the typed text and the hint
    // share the same baseline.
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        style: AppTypography.body.copyWith(fontSize: 13),
        textAlignVertical: TextAlignVertical.center,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          isCollapsed: true,
          hintText: 'Search description, on-complete, or #ID',
          hintStyle: AppTypography.caption.copyWith(fontSize: 12),
          prefixIcon: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Icon(Icons.search,
                color: AppColors.accentPrimary, size: 18),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 34, minHeight: 0),
          suffixIcon: controller.text.isEmpty
              ? null
              : GestureDetector(
                  onTap: () {
                    controller.clear();
                    onChanged('');
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.close,
                        size: 16, color: AppColors.textDim),
                  ),
                ),
          suffixIconConstraints:
              const BoxConstraints(minWidth: 32, minHeight: 0),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
        ),
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: count > 0
              ? AppColors.accentPrimary.withValues(alpha: 0.18)
              : AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: count > 0
                ? AppColors.accentPrimary.withValues(alpha: 0.7)
                : AppColors.borderSubtle,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.tune,
              size: 16,
              color: count > 0
                  ? AppColors.accentPrimary
                  : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              'Filters',
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: count > 0
                    ? AppColors.accentPrimary
                    : AppColors.textSecondary,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.accentPrimary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: AppTypography.mono.copyWith(
                    fontSize: 10,
                    color: AppColors.bgDeepest,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActiveChipsRow extends ConsumerWidget {
  const _ActiveChipsRow({required this.filter});
  final JobFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = <(_Chip, void Function())>[];

    void add(String label, Color tint, void Function() onRemove) =>
        entries.add((_Chip(label: label, tint: tint), onRemove));

    final n = ref.read(jobFilterControllerProvider.notifier);
    for (final t in filter.types) {
      add('type: $t', AppColors.accentPrimary,
          () => n.update((f) => f.copyWith(types: {...f.types}..remove(t))));
    }
    for (final f in filter.alliedFactions) {
      final info = JobTaxonomies.lookup(f);
      add('ally: ${info?.label ?? f}', info?.tint ?? AppColors.accentSecondary,
          () => n.update((g) => g.copyWith(
              alliedFactions: {...g.alliedFactions}..remove(f))));
    }
    for (final f in filter.rivalFactions) {
      final info = JobTaxonomies.lookup(f);
      add('rival: ${info?.label ?? f}', info?.tint ?? AppColors.accentDanger,
          () => n.update((g) => g.copyWith(
              rivalFactions: {...g.rivalFactions}..remove(f))));
    }
    for (final r in filter.rewards) {
      add('reward: ${JobTaxonomies.rewardLabel(r)}',
          JobTaxonomies.rewardTint(r),
          () => n.update((g) => g.copyWith(rewards: {...g.rewards}..remove(r))));
    }
    for (final s in filter.skills) {
      add('skill: $s',
          JobTaxonomies.skills[s] ?? AppColors.accentSecondary,
          () => n.update((g) => g.copyWith(skills: {...g.skills}..remove(s))));
    }
    for (final t in filter.tags) {
      add('tag: ${JobTaxonomies.tags[t] ?? t}', AppColors.accentSuccess,
          () => n.update((g) => g.copyWith(tags: {...g.tags}..remove(t))));
    }
    if (filter.skillAmt.start > 0 || filter.skillAmt.end < 100) {
      add(
        'skill ≥${filter.skillAmt.start.round()}..${filter.skillAmt.end.round()}',
        AppColors.accentSecondary,
        () => n.update((g) =>
            g.copyWith(skillAmt: const RangeValues(0, 100))),
      );
    }
    if (filter.requiredRep.start > 0 || filter.requiredRep.end < 8) {
      add(
        'rep ${filter.requiredRep.start.round()}..${filter.requiredRep.end.round()}',
        AppColors.accentSecondary,
        () => n.update(
            (g) => g.copyWith(requiredRep: const RangeValues(0, 8))),
      );
    }
    if (filter.risk.start > 0 || filter.risk.end < 14) {
      add(
        'risk ${filter.risk.start.round()}..${filter.risk.end.round()}',
        AppColors.accentWarn,
        () => n.update((g) => g.copyWith(risk: const RangeValues(0, 14))),
      );
    }
    if (filter.bonus.start > 0 || filter.bonus.end < 500) {
      add(
        'bonus ${filter.bonus.start.round()}..${filter.bonus.end.round()}',
        AppColors.accentWarn,
        () => n.update((g) => g.copyWith(bonus: const RangeValues(0, 500))),
      );
    }
    if (filter.pickupAstnum != null) {
      add('pickup ast ${filter.pickupAstnum}', AppColors.accentPrimary,
          () => n.update((g) => g.copyWith(clearPickupAstnum: true)));
    }
    if (filter.pickupZone != null) {
      add('pickup z${filter.pickupZone}', AppColors.accentPrimary,
          () => n.update((g) => g.copyWith(clearPickupZone: true)));
    }
    if (filter.dropoffAstnum != null) {
      add('dropoff ast ${filter.dropoffAstnum}', AppColors.accentPrimary,
          () => n.update((g) => g.copyWith(clearDropoffAstnum: true)));
    }
    if (filter.dropoffZone != null) {
      add('dropoff z${filter.dropoffZone}', AppColors.accentPrimary,
          () => n.update((g) => g.copyWith(clearDropoffZone: true)));
    }
    if (filter.onSiteOnly) {
      add('on-site only', AppColors.accentSuccess,
          () => n.update((g) => g.copyWith(onSiteOnly: false)));
    }
    if (filter.cargoJobsOnly) {
      add('cargo only', AppColors.accentWarn,
          () => n.update((g) => g.copyWith(cargoJobsOnly: false)));
    }
    if (filter.rivalImpactOnly) {
      add('rival impact', AppColors.accentDanger,
          () => n.update((g) => g.copyWith(rivalImpactOnly: false)));
    }
    if (filter.hidePlaceholder) {
      add('hide ???', AppColors.textDim,
          () => n.update((g) => g.copyWith(hidePlaceholder: false)));
    }

    if (entries.isEmpty) return const SizedBox(height: 0);
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: entries.length,
        separatorBuilder: (context, index) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final (chip, onRemove) = entries[i];
          return GestureDetector(
            onTap: () {
              Haptics.of(ref).selection();
              onRemove();
            },
            child: chip,
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.tint});
  final String label;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tint.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: AppTypography.mono.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: tint,
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.close, size: 12, color: tint),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isFiltered, required this.onReset});
  final bool isFiltered;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off,
                color: AppColors.accentWarn, size: 48),
            const SizedBox(height: AppSpacing.md),
            Text(
              isFiltered ? 'No jobs match these filters.' : 'No jobs.',
              style: AppTypography.headline,
            ),
            if (isFiltered) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Loosen the criteria or reset everything.',
                style: AppTypography.caption,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton.tonal(
                onPressed: onReset,
                child: const Text('Reset filters'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet shown when the user taps the info icon in the Jobs banner.
/// Discloses the data source (Lama's extract) and the "corrections welcome"
/// invitation requested by community feedback.
class _JobsAboutSheet extends StatelessWidget {
  const _JobsAboutSheet();

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.45,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      builder: (context, controller) {
        return Container(
          decoration: BoxDecoration(
            color: AppColors.bgElevated,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border(top: BorderSide(color: AppColors.borderSubtle)),
          ),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg,
          ),
          child: ListView(
            controller: controller,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.borderSubtle,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text('About this dataset', style: AppTypography.headline),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'The 371 jobs listed here come from an extract Lama shared '
                'directly with the project. The numbers, locations, factions '
                'and reward functions are passed through as-is.',
                style: AppTypography.body.copyWith(height: 1.4),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.bgGlass,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.flag_outlined,
                            color: AppColors.accentWarn, size: 16),
                        const SizedBox(width: AppSpacing.sm),
                        Text('Spotted a wrong value?',
                            style: AppTypography.headline.copyWith(fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'If a job is missing, mislabelled, or has a reward that '
                      'looks off (negative bonus, weird amount, wrong faction), '
                      'send the correction through the in-app Contact form or '
                      'drop it in the project Discord. Every fix lands in the '
                      'next build.',
                      style: AppTypography.caption.copyWith(height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Some fields read "amount unknown" — that means the source '
                'extract had a zero bonus for that job, so the actual reward '
                'count is either dynamic or simply not recorded yet.',
                style: AppTypography.caption.copyWith(
                  color: AppColors.textDim,
                  height: 1.4,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
