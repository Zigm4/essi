import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/banner_page.dart';
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
      body: AppBackground(
        showsScanlines: false,
        child: BannerPage(
          bannerLabel: mode == CapturesMode.notes
              ? 'ESSI · Operator Logbook'
              : 'ESSI · External Comms Cache',
          bannerActions: [
            _BannerIconButton(
              icon: Icons.add,
              onTap: () {
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
          builder: (context, ctrl) => Column(
            children: [
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
              Expanded(
                child: mode == CapturesMode.notes
                    ? NotesListView(scrollController: ctrl)
                    : LinksListView(scrollController: ctrl),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BannerIconButton extends StatelessWidget {
  const _BannerIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Icon(icon, color: AppColors.accentPrimary, size: 18),
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
