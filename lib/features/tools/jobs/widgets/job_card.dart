import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';
import '../../../favorites/data/favorites_repository.dart';
import '../../../favorites/widgets/favorite_button.dart';
import '../data/job_status_repository.dart';
import '../domain/job.dart';
import '../domain/job_taxonomies.dart';

/// Compact card surfacing the most actionable fields for a job: type badge,
/// allied/rival faction tints, description (truncated), and an at-a-glance
/// row of skill / risk / reward / locations.
class JobCard extends ConsumerWidget {
  const JobCard({super.key, required this.job, required this.onTap});

  final Job job;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ally = JobTaxonomies.lookup(job.factionRep);
    final rival = JobTaxonomies.lookup(job.factionRival);
    final progress = ref.watch(jobProgressProvider(job.id.toString()));
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Badges + ID. Wrap so the long combinations (e.g. type +
            // allied + rival faction names + ID) reflow instead of clipping
            // off the right edge of the card.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _TypeBadge(label: job.typeRaw),
                      if (ally != null) _FactionDot(info: ally),
                      if (rival != null) ...[
                        Icon(Icons.gpp_bad,
                            size: 11,
                            color: rival.tint.withValues(alpha: 0.9)),
                        _FactionDot(info: rival, hostile: true),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                if (progress != JobProgress.todo) ...[
                  _StatusPill(progress: progress),
                  const SizedBox(width: 6),
                ],
                Text(
                  '#${job.id}',
                  style: AppTypography.mono.copyWith(
                    fontSize: 10,
                    color: AppColors.textDim,
                  ),
                ),
                FavoriteButton(
                  kind: FavoriteKind.job,
                  id: job.id.toString(),
                  size: 18,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            _PlainDescription(text: job.description),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (job.requiredSkill != null)
                  _Stat(
                    icon: Icons.bolt,
                    tint: JobTaxonomies.skills[job.requiredSkill!] ??
                        AppColors.accentSecondary,
                    label:
                        '${job.requiredSkill}${job.requiredSkillAmt > 0 ? ' ≥${job.requiredSkillAmt}' : ''}',
                  ),
                _Stat(
                  icon: Icons.warning_amber,
                  tint: _riskTint(job.risk),
                  label: 'risk ${job.risk}',
                ),
                _Stat(
                  icon: Icons.local_atm,
                  tint: JobTaxonomies.rewardTint(job.reward),
                  label:
                      '${JobTaxonomies.rewardLabel(job.reward)} ${job.bonus == 0 ? '?' : (job.bonus > 0 ? '+${job.bonus}' : '${job.bonus}')}',
                ),
                _Stat(
                  icon: Icons.place,
                  tint: AppColors.accentPrimary,
                  label: job.isOnSite
                      ? job.pickup.label
                      : '${job.pickup.label} → ${job.dropoff.label}',
                ),
                if (job.isCargoJob)
                  _Stat(
                    icon: Icons.local_shipping,
                    tint: AppColors.accentWarn,
                    label:
                        'cap ${job.capacity}${job.ship != null ? ' · ${job.ship}' : ''}',
                  ),
                if (job.requiredTag != null)
                  _Stat(
                    icon: Icons.shield_outlined,
                    tint: AppColors.accentSuccess,
                    label: JobTaxonomies.tags[job.requiredTag!] ??
                        job.requiredTag!,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _riskTint(int r) {
    if (r >= 7) return AppColors.accentDanger;
    if (r >= 3) return AppColors.accentWarn;
    return AppColors.accentSuccess;
  }
}

/// Small pill shown on advanced jobs (in-progress / done). Colour-coded so the
/// board reads at a glance.
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.progress});
  final JobProgress progress;

  @override
  Widget build(BuildContext context) {
    final tint = progress == JobProgress.done
        ? AppColors.accentSuccess
        : AppColors.accentWarn;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: tint.withValues(alpha: 0.6), width: 0.7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            progress == JobProgress.done
                ? Icons.check_circle_outline
                : Icons.pending_outlined,
            size: 10,
            color: tint,
          ),
          const SizedBox(width: 3),
          Text(
            progress == JobProgress.done ? 'DONE' : 'WIP',
            style: AppTypography.mono.copyWith(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: tint,
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.accentPrimary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: AppColors.accentPrimary.withValues(alpha: 0.5),
        ),
      ),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.mono.copyWith(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
          color: AppColors.accentPrimary,
        ),
      ),
    );
  }
}

class _FactionDot extends StatelessWidget {
  const _FactionDot({required this.info, this.hostile = false});
  final FactionInfo info;
  final bool hostile;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: info.tint.withValues(alpha: hostile ? 0.06 : 0.16),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: info.tint.withValues(alpha: hostile ? 0.5 : 0.7),
          width: 0.7,
        ),
      ),
      child: Text(
        info.label,
        style: AppTypography.mono.copyWith(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: info.tint,
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.tint, required this.label});
  final IconData icon;
  final Color tint;
  final String label;

  @override
  Widget build(BuildContext context) {
    // ConstrainedBox bounds a single chip's width so a very long stat (e.g. a
    // location with both name and 9-digit coords) never exceeds the available
    // Wrap line width and triggers a RenderFlex overflow. The inner Flexible
    // + maxLines:1 + ellipsis collapses gracefully when the chip is full.
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 240),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: tint),
          const SizedBox(width: 3),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
              style: AppTypography.mono.copyWith(
                fontSize: 10.5,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Trims `description` to a clean 2-line teaser. The source uses markdown
/// emphasis (`**…**`, backticks) which we strip for the list-level preview.
class _PlainDescription extends StatelessWidget {
  const _PlainDescription({required this.text});
  final String text;

  static String _plain(String s) => s
      .replaceAll(RegExp(r'\*\*'), '')
      .replaceAll(RegExp('``'), '')
      .replaceAll(RegExp(r'`'), '');

  @override
  Widget build(BuildContext context) {
    return Text(
      _plain(text),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.body.copyWith(height: 1.25, fontSize: 13),
    );
  }
}
