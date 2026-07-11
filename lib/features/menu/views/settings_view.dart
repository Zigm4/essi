import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

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
import '../../knowledge/maps/data/map_content_repository.dart';
import '../../knowledge/maps/data/map_seed_importer.dart';

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
                          final result = await exportService.shareExport(
                            sharePositionOrigin: origin,
                          );
                          // P3/25: an export is a backup — refresh the reminder.
                          // E1: but only when the share wasn't dismissed. Some
                          // platforms report `unavailable` even on success, so
                          // treat anything that isn't a dismissal as done.
                          if (result.status != ShareResultStatus.dismissed) {
                            await notifier.markBackedUp();
                          }
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
                      title: 'Auto-backup',
                      subtitle:
                          'After you make a batch of changes, quietly save a '
                          'timestamped safety copy inside the app and keep the '
                          'latest few. For a file you control, use Export above '
                          'to share the JSON somewhere durable.',
                      value: settings.autoBackupEnabled,
                      onChange: (v) => notifier.setAutoBackupEnabled(v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              const _MapsSettingsCard(),
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
    this.enabled = true,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChange;

  /// When false the switch is dimmed and inert (e.g. auto-update while the
  /// master maps-network switch is off).
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Row(
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
            onChanged: enabled ? onChange : null,
            activeThumbColor: AppColors.accentSuccess,
          ),
        ],
      ),
    );
  }
}

/// Maps module controls: the network-default off-switch, the auto-update
/// toggle, and a "Downloaded maps" size + clear affordance. Fetch-by-default
/// per the owner's decision — [AppSettingsState.mapsNetworkEnabled] defaults on
/// and this is where the user turns it off.
class _MapsSettingsCard extends ConsumerWidget {
  const _MapsSettingsCard();

  static String _formatBytes(int bytes) {
    if (bytes <= 0) return 'none';
    const units = ['B', 'KB', 'MB', 'GB'];
    var value = bytes.toDouble();
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    final rounded = value >= 10 || unit == 0
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(1);
    return '$rounded ${units[unit]}';
  }

  Future<void> _clear(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('Clear downloaded maps?', style: AppTypography.headline),
        content: Text(
          'This frees up space by removing downloaded map content. The '
          'built-in sample map is restored, and maps re-download the next '
          'time you open them (if downloads are on).',
          style: AppTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text('Clear',
                style: TextStyle(color: AppColors.accentDanger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final repo = await ref.read(mapContentRepositoryProvider.future);
      await repo.clearAllContent();
      // Forget the seed-import guard so the bundled baseline re-imports at the
      // next Knowledge entry, and refresh the dependent providers.
      await resetMapSeedImportGuard(ref.read(sharedPreferencesProvider));
      ref.invalidate(mapsStoreSizeProvider);
      ref.invalidate(mapsInstalledVersionProvider);
      ref.invalidate(mapsManifestProvider);
      ref.invalidate(mapSeedImportProvider);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not clear maps. Try again.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    final notifier = ref.read(appSettingsProvider.notifier);
    final size = ref.watch(mapsStoreSizeProvider).valueOrNull;
    final version = ref.watch(mapsInstalledVersionProvider).valueOrNull;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Interactive maps',
            icon: Icons.map,
          ),
          const SizedBox(height: AppSpacing.sm),
          _ToggleRow(
            title: 'Download interactive maps',
            subtitle:
                'Fetch new and updated maps from GitHub (Pages/Fastly + '
                'jsDelivr), at most once a day. Off keeps only what is already '
                'on your device.',
            value: settings.mapsNetworkEnabled,
            onChange: (v) => notifier.setMapsNetworkEnabled(v),
          ),
          const SizedBox(height: AppSpacing.md),
          _ToggleRow(
            title: 'Auto-update maps',
            subtitle:
                'Automatically check for newer map content in the background. '
                'Turn off to update only when you choose.',
            value: settings.mapsAutoUpdate,
            enabled: settings.mapsNetworkEnabled,
            onChange: (v) => notifier.setMapsAutoUpdate(v),
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoLine(
            label: 'Installed version',
            value: version == null || version.isEmpty ? 'none' : version,
          ),
          const SizedBox(height: 6),
          _ManagementRow(
            label: 'Downloaded maps',
            value: size == null ? '…' : _formatBytes(size),
            onClear: () => _clear(context, ref),
          ),
        ],
      ),
    );
  }
}

/// A read-only "label: value" line (installed content version) in the maps card,
/// styled to match [_ManagementRow]'s label/value pairing.
class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: AppTypography.body,
        children: [
          TextSpan(text: '$label: '),
          TextSpan(
            text: value,
            style: AppTypography.body.copyWith(
              fontFamily: AppTypography.fontMono,
              color: AppColors.accentSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// "Downloaded maps: X   [Clear]" row for the maps card.
class _ManagementRow extends StatelessWidget {
  const _ManagementRow({
    required this.label,
    required this.value,
    required this.onClear,
  });

  final String label;
  final String value;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: RichText(
            text: TextSpan(
              style: AppTypography.body,
              children: [
                TextSpan(text: '$label: '),
                TextSpan(
                  text: value,
                  style: AppTypography.body.copyWith(
                    fontFamily: AppTypography.fontMono,
                    color: AppColors.accentSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Semantics(
          button: true,
          label: 'Clear downloaded maps',
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onClear,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                border: Border.all(
                  color: AppColors.accentDanger.withValues(alpha: 0.5),
                ),
              ),
              child: Text(
                'Clear',
                style: AppTypography.body
                    .copyWith(color: AppColors.accentDanger),
              ),
            ),
          ),
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
