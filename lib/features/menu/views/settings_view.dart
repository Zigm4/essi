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
                    const SizedBox(height: AppSpacing.md),
                    _ToggleRow(
                      title: 'Fast boot',
                      subtitle:
                          'Skip the boot intro and jump straight into the app on launch.',
                      value: settings.fastBoot,
                      onChange: (v) => notifier.setFastBoot(v),
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
                    _ExportRow(
                      onExport: (origin) async {
                        try {
                          await exportService.shareExport(
                            sharePositionOrigin: origin,
                          );
                          // P3/25: an export is a backup — refresh the reminder.
                          await notifier.markBackedUp();
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(friendlyError(e,
                                    fallback: 'Export failed. Please try again.')),
                              ),
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
                          // F60: show the human message (FormatException.message)
                          // instead of the raw "FormatException: …" dump.
                          final msg =
                              e is FormatException ? e.message : 'Import failed';
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(msg)),
                            );
                          }
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _ToggleRow(
                      title: 'Auto-backup to Files',
                      subtitle:
                          'After you make a batch of changes, quietly save a '
                          'timestamped copy into the app\'s Documents folder '
                          '(reachable from Files). Keeps the latest few.',
                      value: settings.autoBackupEnabled,
                      onChange: (v) => notifier.setAutoBackupEnabled(v),
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
                      title: 'Intro',
                      icon: Icons.satellite_alt,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Replay the incoming-transmission intro that explains '
                      'Underdeck, the tools and the privacy promise.',
                      style: AppTypography.caption,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ActionRow(
                      label: 'Replay intro',
                      icon: Icons.replay,
                      onTap: () {
                        Haptics.of(ref).tap();
                        context.push('/onboarding');
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

/// Export action row that captures its on-screen rect at tap time and
/// forwards it to share_plus so the iPad popover (and SceneDelegate-based
/// iOS apps in general) can anchor the share sheet correctly.
class _ExportRow extends ConsumerStatefulWidget {
  const _ExportRow({required this.onExport});
  final Future<void> Function(Rect origin) onExport;

  @override
  ConsumerState<_ExportRow> createState() => _ExportRowState();
}

class _ExportRowState extends ConsumerState<_ExportRow> {
  final GlobalKey _key = GlobalKey();

  Rect _originRect() {
    final ctx = _key.currentContext;
    if (ctx == null) return const Rect.fromLTWH(0, 0, 1, 1);
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) {
      return const Rect.fromLTWH(0, 0, 1, 1);
    }
    final topLeft = box.localToGlobal(Offset.zero);
    return topLeft & box.size;
  }

  @override
  Widget build(BuildContext context) {
    return KeyedSubtree(
      key: _key,
      child: _ActionRow(
        label: 'Export…',
        icon: Icons.upload,
        onTap: () async {
          Haptics.of(ref).tap();
          await widget.onExport(_originRect());
        },
      ),
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
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
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
