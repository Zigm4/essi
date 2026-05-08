import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/app_settings.dart';
import '../../../services/data_export.dart';
import '../../../services/haptics.dart';

class SettingsView extends ConsumerWidget {
  const SettingsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    final notifier = ref.read(appSettingsProvider.notifier);
    final exportService = ref.read(dataExportServiceProvider);
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Settings', style: AppTypography.headline),
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
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Feedback',
                      icon: Icons.graphic_eq,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ToggleRow(
                      title: 'Haptic feedback',
                      subtitle: 'Vibrations on tap, save, and selection.',
                      value: settings.hapticsEnabled,
                      onChange: (v) async {
                        await notifier.setHapticsEnabled(v);
                        if (v) Haptics.of(ref).tap();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Motion',
                      icon: Icons.auto_awesome,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ToggleRow(
                      title: 'Animations',
                      subtitle:
                          'Console reveals, particles, pulsing glows, blinking cursors and the boot intro typewriter.',
                      value: !settings.reduceAnimations,
                      onChange: (v) =>
                          notifier.setReduceAnimations(!v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'Data',
                      icon: Icons.data_object,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Backup or move your data between devices using a JSON file.',
                      style: AppTypography.caption,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ActionRow(
                      label: 'Export…',
                      icon: Icons.upload,
                      onTap: () async {
                        Haptics.of(ref).tap();
                        try {
                          await exportService.shareExport();
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Export failed: $e')),
                            );
                          }
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ActionRow(
                      label: 'Import…',
                      icon: Icons.download,
                      onTap: () async {
                        Haptics.of(ref).tap();
                        try {
                          final summary =
                              await exportService.importFromUserPick();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(summary.describe())),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Import failed: $e')),
                            );
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(
                      title: 'What stays on',
                      icon: Icons.shield,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const _Bullet('CRT scanlines and hex grid (static, no motion).'),
                    const _Bullet('Critical UI feedback (errors, save success).'),
                    const _Bullet('Save flash on edit (very brief, accessibility-safe).'),
                    const _Bullet('Static splash on launch.'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChange,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTypography.body),
              const SizedBox(height: 2),
              Text(subtitle, style: AppTypography.caption),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Switch(
          value: value,
          onChanged: onChange,
          activeThumbColor: AppColors.accentSuccess,
        ),
      ],
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.label,
    required this.icon,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.borderSubtle),
          color: AppColors.bgGlass,
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.accentPrimary, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Text(label, style: AppTypography.body),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppColors.textDim),
          ],
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.check_circle,
            color: AppColors.accentSuccess,
            size: 14,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(text, style: AppTypography.caption)),
        ],
      ),
    );
  }
}
