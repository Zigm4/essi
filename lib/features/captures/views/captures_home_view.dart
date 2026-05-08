import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import 'link_editor_view.dart';
import 'links_list_view.dart';
import 'note_editor_view.dart';
import 'notes_list_view.dart';

enum CapturesMode { notes, links }

final capturesModeProvider = StateProvider<CapturesMode>((ref) => CapturesMode.notes);

class CapturesHomeView extends ConsumerWidget {
  const CapturesHomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(capturesModeProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          mode == CapturesMode.notes ? 'Notes' : 'Links',
          style: AppTypography.headline,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle, color: AppColors.accentPrimary),
            onPressed: () {
              Haptics.of(ref).tap();
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => mode == CapturesMode.notes
                    ? const NoteEditorView()
                    : const LinkEditorView(),
              );
            },
          ),
        ],
      ),
      body: AppBackground(
        showsScanlines: false,
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: kToolbarHeight + AppSpacing.sm),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                child: _Segmented(
                  current: mode,
                  onChange: (m) {
                    Haptics.of(ref).selection();
                    ref.read(capturesModeProvider.notifier).state = m;
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: mode == CapturesMode.notes
                    ? const NotesListView()
                    : const LinksListView(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({required this.current, required this.onChange});
  final CapturesMode current;
  final ValueChanged<CapturesMode> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgGlass,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      padding: const EdgeInsets.all(2),
      child: Row(
        children: [
          for (final m in CapturesMode.values)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChange(m),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: current == m
                        ? AppColors.accentPrimary.withValues(alpha: 0.16)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.sm - 2),
                    border: Border.all(
                      color: current == m
                          ? AppColors.accentPrimary
                          : Colors.transparent,
                      width: 1,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      m == CapturesMode.notes ? 'Notes' : 'Links',
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        color: current == m
                            ? AppColors.accentPrimary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
