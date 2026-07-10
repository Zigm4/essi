import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../../tools/jobs/views/job_detail_sheet.dart';
import '../data/global_search_providers.dart';
import '../domain/global_search_models.dart';

/// Unified global search (AUDIT-V2 §6.4). One query field federates across map
/// zones, KB articles, jobs, wallets, captures and personal map notes; results
/// are grouped by source, each group capped with a "more" affordance. Input is
/// debounced (~250ms) and every source runs concurrently off the UI thread.
class GlobalSearchView extends ConsumerStatefulWidget {
  const GlobalSearchView({super.key});

  @override
  ConsumerState<GlobalSearchView> createState() => _GlobalSearchViewState();
}

class _GlobalSearchViewState extends ConsumerState<GlobalSearchView> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  String _query = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    // Open with the keyboard up so the user can type immediately.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      setState(() => _query = value.trim());
    });
  }

  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    setState(() => _query = '');
    _focus.requestFocus();
  }

  void _open(GlobalSearchHit hit) {
    Haptics.of(ref).tap();
    final target = hit.target;
    switch (target) {
      case RouteTarget():
        context.push(target.location);
      case WalletTarget():
        context.push('/tools/wallet?q=${Uri.encodeComponent(target.query)}');
      case JobTarget():
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => JobDetailSheet(job: target.job),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Search', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: PageScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SearchField(
                controller: _controller,
                focusNode: _focus,
                onChanged: _onChanged,
                onClear: _clear,
              ),
              const SizedBox(height: AppSpacing.md),
              if (_query.isEmpty)
                const _Hint()
              else
                _Results(query: _query, onOpen: _open),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      autocorrect: false,
      style: AppTypography.body,
      decoration: InputDecoration(
        hintText: 'Search maps, jobs, wallets, notes…',
        hintStyle: AppTypography.body.copyWith(color: AppColors.textDim),
        prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close, color: AppColors.textSecondary),
                tooltip: 'Clear search',
                onPressed: onClear,
              ),
        filled: true,
        fillColor: AppColors.bgGlass,
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.borderGlow),
        ),
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xl),
      child: Column(
        children: [
          Icon(Icons.travel_explore,
              color: AppColors.textDim.withValues(alpha: 0.6), size: 40),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Search everything',
            style: AppTypography.headline,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Find map zones, knowledge base articles, jobs, wallets, '
            'and your own notes — all in one place.',
            style: AppTypography.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _Results extends ConsumerWidget {
  const _Results({required this.query, required this.onOpen});

  final String query;
  final ValueChanged<GlobalSearchHit> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(globalSearchProvider(query));
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.only(top: AppSpacing.xl),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.only(top: AppSpacing.xl),
        child: Text(
          friendlyError(e, fallback: "Couldn't run that search."),
          style: AppTypography.body.copyWith(color: AppColors.accentDanger),
        ),
      ),
      data: (bySource) {
        final groups = federateSearchResults(bySource);
        if (totalHitCount(groups) == 0) {
          return Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xl),
            child: Column(
              children: [
                Icon(Icons.search_off, color: AppColors.accentWarn, size: 36),
                const SizedBox(height: AppSpacing.sm),
                Text('No matches', style: AppTypography.headline),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Nothing matched “$query”. Try a different term.',
                  style: AppTypography.caption,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final group in groups) ...[
              _Group(group: group, onOpen: onOpen),
              const SizedBox(height: AppSpacing.lg),
            ],
          ],
        );
      },
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.group, required this.onOpen});

  final SearchGroup<GlobalSearchHit> group;
  final ValueChanged<GlobalSearchHit> onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: group.source.groupTitle,
          subtitle: '${group.total} result${group.total == 1 ? '' : 's'}',
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final hit in group.visible) ...[
          _ResultRow(hit: hit, onTap: () => onOpen(hit)),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (group.hasMore)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xxs),
            child: Text(
              '+${group.hiddenCount} more — refine your search to narrow down.',
              style: AppTypography.caption,
            ),
          ),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.hit, required this.onTap});

  final GlobalSearchHit hit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${hit.title}. ${hit.subtitle}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: GlassCard(
          child: Row(
            children: [
              Icon(hit.icon, color: AppColors.accentPrimary, size: 20),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hit.title,
                      style: AppTypography.headline,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (hit.subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        hit.subtitle,
                        style: AppTypography.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right,
                  color: AppColors.textDim, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
