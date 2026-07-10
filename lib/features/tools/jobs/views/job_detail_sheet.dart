import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../data/job_status_repository.dart';
import '../domain/job.dart';
import '../domain/job_taxonomies.dart';
import '../widgets/job_share_card.dart';

class JobDetailSheet extends ConsumerWidget {
  const JobDetailSheet({super.key, required this.job});
  final Job job;

  Future<void> _copyId(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    await Clipboard.setData(ClipboardData(text: job.id.toString()));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Copied #${job.id}')),
      );
    }
  }

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    Haptics.of(ref).tap();
    final ok = await ShareCardCapture.share(
      context: context,
      card: JobShareCard(job: job),
      fileName: 'underdeck-job-${job.id}.png',
      text: 'Underdeck job #${job.id}',
      sharePositionOrigin: ShareCardCapture.originRectFor(context),
    );
    if (!ok && context.mounted) {
      ShareCardCapture.showShareFailure(context);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ally = JobTaxonomies.lookup(job.factionRep);
    final rival = JobTaxonomies.lookup(job.factionRival);
    return DraggableScrollableSheet(
      initialChildSize: 0.78,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, controller) {
        return ClipRRect(
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
          child: Container(
            color: AppColors.bgElevated,
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.textDim,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        job.typeRaw.toUpperCase(),
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                          color: AppColors.accentPrimary,
                        ),
                      ),
                    ),
                    FavoriteButton(
                      kind: FavoriteKind.job,
                      id: job.id.toString(),
                      size: 22,
                    ),
                    IconButton(
                      onPressed: () => _share(context, ref),
                      icon: const Icon(Icons.ios_share,
                          color: AppColors.accentPrimary, size: 20),
                      tooltip: 'Share job',
                      visualDensity: VisualDensity.compact,
                      constraints: const BoxConstraints(),
                      padding: const EdgeInsets.all(6),
                    ),
                    const SizedBox(width: 2),
                    GestureDetector(
                      onTap: () => _copyId(context, ref),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.bgGlass,
                          border: Border.all(color: AppColors.borderSubtle),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.copy,
                                size: 12, color: AppColors.accentPrimary),
                            const SizedBox(width: 4),
                            Text(
                              '#${job.id}',
                              style: AppTypography.mono.copyWith(
                                fontSize: 11,
                                color: AppColors.accentPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                _StatusControl(jobId: job.id.toString()),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: MarkdownBody(
                    data: job.description,
                    styleSheet: _md(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _kv('Allied faction', ally?.label ?? '—',
                          tint: ally?.tint),
                      _kv('Rival faction',
                          rival?.label ?? (job.factionRival ?? '—'),
                          tint: rival?.tint),
                      _kv(
                        'Required tag',
                        JobTaxonomies.tags[job.requiredTag] ??
                            job.requiredTag ??
                            '—',
                      ),
                      _kv(
                        'Required skill',
                        job.requiredSkill == null
                            ? '—'
                            : '${job.requiredSkill}${job.requiredSkillAmt > 0 ? ' ≥${job.requiredSkillAmt}' : ''}',
                      ),
                      _kv('Required reputation', '${job.requiredRep}'),
                      _kv('Risk', '${job.risk}'),
                      _kv(
                        'Reward',
                        '${JobTaxonomies.rewardLabel(job.reward)} · '
                        '${job.bonus == 0 ? 'amount unknown' : (job.bonus > 0 ? '+${job.bonus}' : '${job.bonus}')}',
                        tint: JobTaxonomies.rewardTint(job.reward),
                      ),
                      _kv('Pickup', job.pickup.label),
                      _kv('Dropoff', job.dropoff.label),
                      if (job.isCargoJob)
                        _kv(
                          'Cargo',
                          'capacity ${job.capacity}${job.ship != null ? ' · ship ${job.ship}' : ''}',
                          tint: AppColors.accentWarn,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ON COMPLETE',
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          letterSpacing: 1.5,
                          color: AppColors.accentSuccess,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      MarkdownBody(
                        data: job.onComplete,
                        styleSheet: _md(context),
                      ),
                    ],
                  ),
                ),
                if (_hasComment(job)) ...[
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.accentWarn.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      border: Border.all(
                        color: AppColors.accentWarn.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline,
                            size: 14, color: AppColors.accentWarn),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Source data may contain inconsistent zone comments. Verify locations in-game before travelling.',
                            style: AppTypography.caption,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _kv(String k, String v, {Color? tint}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              k,
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.textDim,
              ),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: AppTypography.body.copyWith(
                color: tint ?? AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Heuristic — flag jobs whose pickup astnum + zone comment looks
  /// inconsistent. For now we just always show the alert on jobs at zone 70
  /// of astnum 355 (the only confirmed broken comment we know of).
  bool _hasComment(Job job) =>
      job.pickup.astnum == 355 && job.pickup.zone == 70;

  MarkdownStyleSheet _md(BuildContext context) => MarkdownStyleSheet(
        p: AppTypography.body.copyWith(height: 1.4, fontSize: 13),
        strong: AppTypography.body.copyWith(
          fontWeight: FontWeight.w800,
          color: AppColors.accentPrimary,
        ),
        code: AppTypography.mono.copyWith(
          fontSize: 12,
          color: AppColors.accentSecondary,
          backgroundColor: AppColors.bgDeepest,
        ),
        codeblockDecoration: BoxDecoration(
          color: AppColors.bgDeepest,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
      );
}

/// Segmented progress control on the job detail: Not done / In progress / Done.
/// Writes through [JobStatusRepository]; the selection reflects the live status.
class _StatusControl extends ConsumerWidget {
  const _StatusControl({required this.jobId});
  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(jobProgressProvider(jobId));
    Color tintOf(JobProgress p) {
      switch (p) {
        case JobProgress.todo:
          return AppColors.textSecondary;
        case JobProgress.inProgress:
          return AppColors.accentWarn;
        case JobProgress.done:
          return AppColors.accentSuccess;
      }
    }

    return Row(
      children: [
        for (final p in JobProgress.values) ...[
          Expanded(
            child: _StatusSegment(
              label: p.label,
              tint: tintOf(p),
              selected: current == p,
              onTap: () async {
                Haptics.of(ref).selection();
                await ref
                    .read(jobStatusRepositoryProvider)
                    .setStatus(jobId, p);
              },
            ),
          ),
          if (p != JobProgress.done) const SizedBox(width: 6),
        ],
      ],
    );
  }
}

class _StatusSegment extends StatelessWidget {
  const _StatusSegment({
    required this.label,
    required this.tint,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final Color tint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? tint.withValues(alpha: 0.18)
              : AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(
            color: selected
                ? tint.withValues(alpha: 0.8)
                : AppColors.borderSubtle,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: AppTypography.mono.copyWith(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: selected ? tint : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
