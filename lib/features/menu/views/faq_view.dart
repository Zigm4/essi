import 'package:flutter/material.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/components/app_background.dart';
import '../../../design_system/components/glass_card.dart';
import '../../../design_system/components/page_scroll_view.dart';
import '../../../design_system/components/section_header.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';

class _FAQItem {
  final String section;
  final String question;
  final String answer;
  const _FAQItem({
    required this.section,
    required this.question,
    required this.answer,
  });
}

const _entries = <_FAQItem>[
  _FAQItem(
    section: 'operations',
    question: 'Is Underdeck free?',
    answer:
        'Yes. Underdeck is free and will stay free, forever. No ads, no in-app purchases, no premium tier.',
  ),
  _FAQItem(
    section: 'operations',
    question: 'Is this an official UP55 app?',
    answer:
        'No. Underdeck is a fan project. It is not affiliated with or endorsed by Jaydz Dev (alias Lama), the creator of Underpunks55.',
  ),
  _FAQItem(
    section: 'privacy',
    question: 'Does Underdeck collect my data?',
    answer:
        'No. Zero telemetry, zero analytics. The app does not communicate with any server we operate.',
  ),
  _FAQItem(
    section: 'privacy',
    question: 'Where is my data stored?',
    answer:
        'On your device, in a local SQLite database. To move data between devices, use the export/import feature in Settings.',
  ),
  _FAQItem(
    section: 'network',
    question: 'Does the app need internet?',
    answer:
        'Not for normal use. Notes, links, ships, the knowledge base, the Asteroid Analyzer, the Fishing Map, the Mars Express schedule and the Wallet Lookup all work fully offline. Three tools are opt-in and do talk to a network: System Scan, Discoveries, and Tracker. They call NASA APIs (JPL Horizons and SBDB). Nothing happens unless you tap their action button. Interactive maps are the one feature that reaches out on its own: they download map content from GitHub (see the next question). Tapping the Discord invite link in the Menu also opens the network, but only at the moment you tap it.',
  ),
  _FAQItem(
    section: 'network',
    question: 'Where do interactive maps come from?',
    answer:
        'Map content (the map list, each map, and its images) is hosted on GitHub and delivered over a multi-CDN path: GitHub Pages (fronted by Fastly) for the small "which version is current" pointer, and jsDelivr — with raw.githubusercontent.com as a fallback — for the actual files. Downloads are on by default and happen at most once every 24 hours; every file is checked against a SHA-256 hash before it is stored. Nothing about you is sent — these are plain GET requests, so your IP address is visible to those CDNs, and that is all. A built-in sample map ships inside the app so maps work offline on first launch. You can turn downloads off entirely in Settings › Interactive maps, and clear anything already downloaded there too.',
  ),
  _FAQItem(
    section: 'network',
    question: 'What does System Scan send to NASA?',
    answer:
        'When you tap "Scan now" in Tools / System Scan, Underdeck makes 9 GET requests to ssd.jpl.nasa.gov/api/horizons.api, one per planet. Sent: NAIF code (199-999) and current UTC timestamp. Received: public ephemeris text. Visible to NASA: your IP address. Stored: nothing on first run; entries you keep are saved locally.',
  ),
  _FAQItem(
    section: 'network',
    question: 'What does Tracker send to NASA?',
    answer:
        'When you tap "Track" in Tools / Tracker, Underdeck makes 1 to 4 GET requests to JPL Horizons / SBDB. Sent: object name or designation, plus a fixed instruction. No identifier of yours is added. Stored: each successful track is saved to local history. You can delete entries any time.',
  ),
];

class FAQView extends StatelessWidget {
  const FAQView({super.key});

  @override
  Widget build(BuildContext context) {
    final bySection = <String, List<_FAQItem>>{};
    for (final e in _entries) {
      bySection.putIfAbsent(e.section, () => []).add(e);
    }
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('FAQ', style: AppTypography.headline),
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
              for (final entry in bySection.entries) ...[
                SectionHeader(title: entry.key),
                const SizedBox(height: AppSpacing.sm),
                for (final item in entry.value) ...[
                  _Item(item: item),
                  const SizedBox(height: AppSpacing.sm),
                ],
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Item extends StatefulWidget {
  const _Item({required this.item});
  final _FAQItem item;

  @override
  State<_Item> createState() => _ItemState();
}

class _ItemState extends State<_Item> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _open = !_open),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.item.question,
                    style: AppTypography.headline,
                  ),
                ),
                Icon(
                  _open ? Icons.expand_less : Icons.expand_more,
                  color: AppColors.accentPrimary,
                ),
              ],
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Text(widget.item.answer, style: AppTypography.body),
              ),
              crossFadeState:
                  _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
              duration: const Duration(milliseconds: 200),
            ),
          ],
        ),
      ),
    );
  }
}
