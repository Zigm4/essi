import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../design_system/colors.dart';

/// Schemes we allow to leave the app. Imported notes/links can carry arbitrary
/// hrefs (`tel:`, `sms:`, custom app schemes, …); we only ever hand a URL to the
/// OS when it uses one of these safe, expected schemes.
const _allowedSchemes = {'http', 'https', 'mailto'};

/// R4: single, security-conscious entry point for opening a URL that came from
/// importable content. Parses [href], rejects anything outside
/// [_allowedSchemes] (disallowed/unparseable → friendly snackbar, no launch),
/// then launches the rest in the external application.
Future<void> launchExternal(BuildContext context, String href) async {
  final uri = Uri.tryParse(href.trim());
  if (uri == null || !_allowedSchemes.contains(uri.scheme.toLowerCase())) {
    _showBlockedSnackBar(context);
    return;
  }
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    _showBlockedSnackBar(context);
  }
}

void _showBlockedSnackBar(BuildContext context) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text("Couldn't open that link."),
      backgroundColor: AppColors.accentDanger,
    ),
  );
}
