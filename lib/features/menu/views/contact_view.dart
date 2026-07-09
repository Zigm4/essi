import 'dart:io' show File, Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_constants.dart';
import '../../../core/app_version.dart';
import '../../../core/error_text.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/neon_button.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/components/transmission_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/haptics.dart';
import '../../../services/share_card.dart';
import '../../captures/widgets/tag_chip.dart';

enum _ContactCategory { feedback, bug, support, other }

extension on _ContactCategory {
  String get label {
    switch (this) {
      case _ContactCategory.feedback:
        return 'Feedback';
      case _ContactCategory.bug:
        return 'Bug report';
      case _ContactCategory.support:
        return 'Support';
      case _ContactCategory.other:
        return 'Other';
    }
  }

  String get subject => '[Underdeck] $label';
}

class ContactView extends ConsumerStatefulWidget {
  const ContactView({super.key});

  @override
  ConsumerState<ContactView> createState() => _ContactViewState();
}

class _ContactViewState extends ConsumerState<ContactView> {
  _ContactCategory _category = _ContactCategory.feedback;
  final _message = TextEditingController();
  final _picker = ImagePicker();
  final List<XFile> _attachments = [];

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  String get _versionLine {
    final v = ref.read(appVersionProvider).valueOrNull ?? AppVersion.fallback;
    return 'App: Underdeck ${v.fullLabel} (Alpha)';
  }
  String get _deviceLine =>
      'Device: ${Platform.operatingSystem} ${Platform.operatingSystemVersion}';

  /// Picks one or more photos. We accept up to 4 to keep emails reasonable.
  Future<void> _addPhotos() async {
    Haptics.of(ref).selection();
    final remaining = 4 - _attachments.length;
    if (remaining <= 0) return;
    try {
      final picked = await _picker.pickMultiImage(
        imageQuality: 80,
        limit: remaining,
      );
      if (picked.isNotEmpty) {
        setState(() => _attachments.addAll(picked.take(remaining)));
      }
    } catch (e) {
      // Picker can fail silently on permission denial; surface a snackbar.
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(friendlyError(e, fallback: "Couldn't pick that photo. Please try again.")),
        backgroundColor: AppColors.accentDanger,
      ));
    }
  }

  void _removeAttachment(int i) {
    Haptics.of(ref).tap();
    setState(() => _attachments.removeAt(i));
  }

  /// Sends the message via the OS share sheet when there are attachments
  /// (so Mail / Gmail / etc. can attach the photos), or via mailto: when
  /// the message is text-only (cleaner one-tap flow).
  Future<void> _send() async {
    final body = '''${_message.text.trim()}

---
$_versionLine
$_deviceLine
Category: ${_category.label}
Sent to: ${AppConstants.contactEmail}''';

    if (_attachments.isNotEmpty) {
      await SharePlus.instance.share(
        ShareParams(
          subject: _category.subject,
          text: body,
          files: [
            for (final a in _attachments) XFile(a.path),
          ],
          sharePositionOrigin: ShareCardCapture.originRectFor(context),
        ),
      );
      return;
    }

    final uri = Uri(
      scheme: 'mailto',
      path: AppConstants.contactEmail,
      query:
          'subject=${Uri.encodeComponent(_category.subject)}&body=${Uri.encodeComponent(body)}',
    );
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.bgElevated,
          title: Text('No mail account', style: AppTypography.headline),
          content: Text(
            'This device has no Mail account configured. Send a mail manually to ${AppConstants.contactEmail} instead.',
            style: AppTypography.body,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('OK',
                  style: AppTypography.body.copyWith(
                    color: AppColors.accentPrimary,
                  )),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watch so the auto-included version line rebuilds once the async lookup
    // resolves (the getter itself reads the value).
    ref.watch(appVersionProvider);
    final canSend = _message.text.trim().isNotEmpty || _attachments.isNotEmpty;
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Contact', style: AppTypography.headline),
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
              const TransmissionHeader(label: 'ESSI · operator support'),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(title: 'Category', icon: Icons.tag),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final c in _ContactCategory.values)
                          TagChip(
                            label: c.label,
                            selected: c == _category,
                            onTap: () => setState(() => _category = c),
                          ),
                      ],
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
                      title: 'Your message',
                      icon: Icons.mail_outline,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _message,
                      decoration: InputDecoration(
                        hintText: "Tell me what's on your mind…",
                        hintStyle: AppTypography.body.copyWith(
                          color: AppColors.textDim,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                      style: AppTypography.body,
                      minLines: 5,
                      maxLines: 20,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _AttachmentsCard(
                attachments: _attachments,
                onAdd: _addPhotos,
                onRemove: _removeAttachment,
              ),
              const SizedBox(height: AppSpacing.lg),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: AppColors.accentPrimary,
                          size: 14,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Auto-included in the email',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.accentPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(_versionLine,
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        )),
                    Text(_deviceLine,
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        )),
                    Text('Sent to: ${AppConstants.contactEmail}',
                        style: AppTypography.mono.copyWith(
                          fontSize: 11,
                          color: AppColors.accentSecondary,
                        )),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              NeonButton(
                title: _attachments.isEmpty ? 'Open in Mail' : 'Send via share sheet',
                icon: _attachments.isEmpty ? Icons.mail : Icons.ios_share,
                enabled: canSend,
                onPressed: _send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Attachments card: shows the current photos as thumbnails with a + tile
/// at the end (until the cap of 4). Tap a thumbnail's × to remove it.
class _AttachmentsCard extends StatelessWidget {
  const _AttachmentsCard({
    required this.attachments,
    required this.onAdd,
    required this.onRemove,
  });

  final List<XFile> attachments;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  static const _max = 4;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Photos (optional)',
            icon: Icons.photo_library_outlined,
          ),
          const SizedBox(height: 4),
          Text(
            attachments.isEmpty
                ? 'Up to $_max photos. Helpful for bug reports — '
                    'attach a screenshot showing the issue.'
                : '${attachments.length}/$_max attached. Photos travel '
                    'through the OS share sheet so Mail / Gmail can attach them.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 84,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: attachments.length + (attachments.length < _max ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                if (i >= attachments.length) {
                  return _AddTile(onTap: onAdd);
                }
                return _ThumbTile(
                  file: attachments[i],
                  onRemove: () => onRemove(i),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 84, height: 84,
        decoration: BoxDecoration(
          color: AppColors.bgGlass,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(
            color: AppColors.accentPrimary.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
        child: const Icon(Icons.add_a_photo,
            color: AppColors.accentPrimary, size: 28),
      ),
    );
  }
}

class _ThumbTile extends StatelessWidget {
  const _ThumbTile({required this.file, required this.onRemove});
  final XFile file;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          child: Image.file(
            File(file.path),
            width: 84, height: 84, fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              width: 84, height: 84,
              color: AppColors.bgGlass,
              alignment: Alignment.center,
              child: const Icon(Icons.broken_image,
                  color: AppColors.accentDanger),
            ),
          ),
        ),
        Positioned(
          top: 2, right: 2,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              decoration: const BoxDecoration(
                color: AppColors.bgDeepest,
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(2),
              child: const Icon(Icons.close,
                  color: AppColors.accentDanger, size: 14),
            ),
          ),
        ),
      ],
    );
  }
}
