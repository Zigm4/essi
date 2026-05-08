import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_constants.dart';
import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/neon_button.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/components/transmission_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
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

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  String get _versionLine => 'App: Underdeck v0.2.0 (Alpha)';
  String get _deviceLine =>
      'Device: ${Platform.operatingSystem} ${Platform.operatingSystemVersion}';

  Future<void> _send() async {
    final body = '''${_message.text.trim()}

---
$_versionLine
$_deviceLine
Category: ${_category.label}''';
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
              child: Text(
                'OK',
                style: AppTypography.body.copyWith(
                  color: AppColors.accentPrimary,
                ),
              ),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSend = _message.text.trim().isNotEmpty;
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
                title: 'Open in Mail',
                icon: Icons.mail,
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
