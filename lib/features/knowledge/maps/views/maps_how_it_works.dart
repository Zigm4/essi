import 'package:flutter/material.dart';

import '../../../../design_system/components/info_card.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';

/// "How interactive maps work" sheet, shown from the maps gallery. Documents the
/// content pipeline in the app's transparency-brand style (AUDIT-V2 §4.8): where
/// maps come from, how integrity is enforced, how often the app checks, that it
/// works fully offline from the bundled seed, exactly what leaves the device, and
/// the default-on network with its off-switch.
class MapsHowItWorksView extends StatelessWidget {
  const MapsHowItWorksView({super.key});

  @override
  Widget build(BuildContext context) {
    return const HowItWorksSheet(
      cards: [
        TransmissionHeader(label: 'INTERACTIVE MAPS · how this works'),
        _Overview(),
        _Source(),
        _Integrity(),
        _Cadence(),
        _Offline(),
        _LeavesDevice(),
        _Control(),
      ],
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Overview', icon: Icons.map_outlined),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Interactive maps are content — JSON geometry, field data, and images '
            '— not code. They are authored in a public GitHub repository and '
            'delivered to the app as plain data. The app ships with a small '
            'bundled set so maps work on first launch with no network at all; '
            'anything newer is fetched on top of that baseline.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Nothing about your game state, identity, or usage is ever sent. The '
            'map pipeline only ever pulls public files down.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Source extends StatelessWidget {
  const _Source();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Where maps come from', icon: Icons.link),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Two layers. A tiny mutable pointer says "the current maps are at tag '
            'X". The actual content lives at that immutable, tag-pinned tag and '
            'is served from a multi-CDN mirror of the GitHub repo.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Pointer',
            value: 'GitHub Pages (fronted by Fastly). Small JSON, polled with an '
                'ETag so an unchanged pointer is a 304 with no body.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Content',
            value: 'jsDelivr — a multi-CDN (Cloudflare / Fastly / Bunny) mirror '
                'of the repo, pinned to an exact tag so bytes never change under '
                'a version.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Fallback',
            value: 'raw.githubusercontent.com, used only if jsDelivr fails.',
            labelWidth: 96,
          ),
        ],
      ),
    );
  }
}

class _Integrity extends StatelessWidget {
  const _Integrity();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Integrity', icon: Icons.verified_user),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Every document and image is pinned to a sha256 hash in the manifest. '
            'A downloaded file is verified against that hash before it is written '
            'to disk — a mismatch is rejected and the previously installed maps '
            'are kept untouched.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Downloads are size-capped and streamed, so an oversized file is '
            'aborted mid-transfer rather than buffered whole. Because files are '
            'stored by their hash, an unchanged image across versions is reused '
            'for free — never re-downloaded.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Cadence extends StatelessWidget {
  const _Cadence();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'How often it checks', icon: Icons.schedule),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Cadence',
            value: 'At most once every 24 hours, and only when you open the maps '
                'gallery.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Trigger',
            value: 'Opening Interactive maps. No background timers, no push, no '
                'polling while the app is closed.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Apply',
            value: 'A newer pack installs quietly and appears the next time you '
                'open maps — never swapped out mid-view.',
            labelWidth: 96,
          ),
        ],
      ),
    );
  }
}

class _Offline extends StatelessWidget {
  const _Offline();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Works offline', icon: Icons.wifi_off),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'A seed set of maps is bundled inside the app binary and imported '
            'locally on first use — no network required. Rendering always reads '
            'from the on-device store, never the network, so maps stay fully '
            'usable on a plane, underground, or with downloads turned off.',
            style: AppTypography.body,
          ),
        ],
      ),
    );
  }
}

class _LeavesDevice extends StatelessWidget {
  const _LeavesDevice();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
              title: 'What leaves the device', icon: Icons.lock),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Sent',
            value: 'Plain HTTP GET requests for public map files. No account, no '
                'device id, no analytics, no game data.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Visible',
            value: 'Your IP address — the same thing any web request exposes — to '
                'the CDNs serving the files (GitHub / Fastly / jsDelivr).',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Stored remotely',
            value: 'Nothing. There is no Underdeck server.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Stored locally',
            value: 'The downloaded map files, in the app support directory. Clear '
                'them any time from Settings.',
            labelWidth: 96,
          ),
        ],
      ),
    );
  }
}

class _Control extends StatelessWidget {
  const _Control();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Your control', icon: Icons.tune),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Map downloads are on by default so you get the latest content. You '
            'can turn them off entirely.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Off-switch',
            value: 'Settings → Interactive maps → "Download interactive maps". '
                'Off keeps only what is already on your device.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Auto-update',
            value: 'A separate toggle for the once-a-day background check; turn '
                'it off to update only when you choose.',
            labelWidth: 96,
          ),
          const KvRow(
            label: 'Storage',
            value: 'Settings shows the installed version and size, with a Clear '
                'action that keeps the bundled seed usable.',
            labelWidth: 96,
          ),
        ],
      ),
    );
  }
}
