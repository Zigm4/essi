import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'external_link.dart';

/// The custom scheme for links that stay *inside* the app. It is never handed to
/// the OS (no native URI registration / intent-filter / Associated-Domains) — the
/// resolver below turns it into an in-app `go_router` navigation. Content and
/// imported notes can therefore cross-link KB articles and maps without any
/// platform deep-link plumbing (AUDIT-V2 §4.8).
const String kInternalLinkScheme = 'underdeck';

/// Translates an internal `underdeck://` link into the `go_router` path it should
/// navigate to, or returns `null` when [href] is not a recognised internal link
/// (an external URL, an unknown host, or junk). Pure — no `BuildContext` — so it
/// is unit-testable in isolation.
///
/// Recognised forms:
/// - `underdeck://kb/<slug>`            → `/knowledge/article/<slug>`
/// - `underdeck://map/<id>`             → `/knowledge/maps/<id>`
/// - `underdeck://map/<id>?zone=<zone>` → `/knowledge/maps/<id>?zone=<zone>`
///
/// The returned path targets an existing route. A target that no longer exists
/// (a removed article/map) still resolves to a *valid* route whose view renders a
/// real "not found" state — never an infinite spinner (AUDIT-V2 §4.8).
String? resolveInternalLink(String href) {
  final uri = Uri.tryParse(href.trim());
  if (uri == null) return null;
  if (uri.scheme.toLowerCase() != kInternalLinkScheme) return null;

  // The host carries the target *kind*; the first path segment carries the id.
  final kind = uri.host.toLowerCase();
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.isEmpty) return null;
  final id = Uri.encodeComponent(segments.first);

  switch (kind) {
    case 'kb':
      return '/knowledge/article/$id';
    case 'map':
      final zone = uri.queryParameters['zone'];
      final base = '/knowledge/maps/$id';
      return (zone == null || zone.isEmpty)
          ? base
          : '$base?zone=${Uri.encodeComponent(zone)}';
    default:
      return null;
  }
}

/// Single entry point for a link that came from content (a zone `link` field, KB
/// markdown, an imported note). Internal `underdeck://` links push an in-app
/// route; everything else is handed to the allow-listed [launchExternal], which
/// opens `http(s)`/`mailto` externally and shows a friendly "couldn't open" for
/// any other scheme (a safe no-op — no `javascript:`/`file:`/etc. ever launches).
void resolveLink(BuildContext context, String href) {
  final internal = resolveInternalLink(href);
  if (internal != null) {
    context.push(internal);
    return;
  }
  launchExternal(context, href);
}
