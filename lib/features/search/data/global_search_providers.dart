import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/database/app_database.dart';
import '../../captures/data/captures_repository.dart';
import '../../captures/domain/captures_models.dart';
import '../../knowledge/data/kb_loader.dart';
import '../../knowledge/maps/data/map_content_repository.dart';
import '../../knowledge/maps/data/map_pins_repository.dart';
import '../../knowledge/maps/views/map_icons.dart';
import '../../tools/jobs/data/jobs_repository.dart';
import '../../tools/jobs/domain/job.dart';
import '../../tools/jobs/domain/job_taxonomies.dart';
import '../../tools/wallet/views/wallet_lookup_view.dart';
import '../domain/global_search_models.dart';

/// How a search hit is opened when tapped.
@immutable
sealed class GlobalSearchTarget {
  const GlobalSearchTarget();
}

/// Navigate to a `go_router` location (KB article, map zone, capture detail).
class RouteTarget extends GlobalSearchTarget {
  const RouteTarget(this.location);
  final String location;
}

/// Open the job detail modal for [job] (jobs have no standalone route).
class JobTarget extends GlobalSearchTarget {
  const JobTarget(this.job);
  final Job job;
}

/// Open the Wallet Lookup tool pre-seeded with [query].
class WalletTarget extends GlobalSearchTarget {
  const WalletTarget(this.query);
  final String query;
}

/// A single federated search result, ready to render + open.
@immutable
class GlobalSearchHit {
  const GlobalSearchHit({
    required this.source,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.target,
  });

  final SearchSource source;
  final String title;
  final String subtitle;
  final IconData icon;
  final GlobalSearchTarget target;
}

/// Trim + single-line snippet of a free-text body for a compact result row.
String _snippet(String text, {int max = 80}) {
  final flat = text.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (flat.length <= max) return flat;
  return '${flat.substring(0, max).trimRight()}…';
}

String _jobTitle(Job job) => '${job.typeRaw} · #${job.id}';

String _jobSubtitle(Job job) {
  final ally = JobTaxonomies.lookup(job.factionRep)?.label;
  final parts = <String>[
    ?ally,
    if (job.description.trim().isNotEmpty) _snippet(job.description, max: 60),
  ];
  return parts.isEmpty ? 'Job #${job.id}' : parts.join(' · ');
}

/// Federated, un-capped per-source hits for [rawQuery].
///
/// Runs every source concurrently and never blocks the UI: the one heavy source
/// (map-zone FTS on the DB) is kicked first so it runs while the cheap in-memory
/// sources (KB index, jobs, wallets, captures, pins) are gathered. The heavy
/// jobs.json decode already happens off-isolate in its own repository. The UI
/// applies [federateSearchResults] to order + cap the returned map. A blank
/// query yields empty groups (no work).
final globalSearchProvider = FutureProvider.autoDispose
    .family<Map<SearchSource, List<GlobalSearchHit>>, String>(
        (ref, rawQuery) async {
  final query = rawQuery.trim();
  final empty = <SearchSource, List<GlobalSearchHit>>{};
  if (query.isEmpty) return empty;
  final q = query.toLowerCase();

  // Kick the async sources first (futures already in-flight) so awaiting them
  // below does not serialise the work.
  final mapZonesF = ref.watch(mapZoneSearchProvider(query).future);
  final kbF = ref.watch(kbDataProvider.future);
  final jobsF = ref.watch(jobsRepositoryProvider.future);
  final walletF = ref.watch(walletDataProvider.future);

  // Local DB streams resolve fast and keep the results live as the user edits
  // notes / pins; a not-yet-loaded stream simply contributes nothing this pass.
  final notes = ref.watch(notesStreamProvider).valueOrNull ?? const <NoteModel>[];
  final links = ref.watch(linksStreamProvider).valueOrNull ?? const <LinkModel>[];
  final pins = ref.watch(allMapPinsProvider).valueOrNull ?? const <MapPin>[];

  final mapZones = await mapZonesF;
  final kb = await kbF;
  final jobsRepo = await jobsF;
  final wallet = await walletF;

  // --- Map zones (FTS; provider already drops non-openable maps) -------------
  final mapZoneHits = <GlobalSearchHit>[
    for (final r in mapZones)
      GlobalSearchHit(
        source: SearchSource.mapZone,
        title: r.zoneName,
        subtitle: r.mapTitle,
        icon: mapIconData(r.mapIcon),
        target: RouteTarget(
          '/knowledge/maps/${Uri.encodeComponent(r.mapId)}'
          '?zone=${Uri.encodeComponent(r.zoneId)}',
        ),
      ),
  ];

  // --- KB articles (existing ASCII prefix index) -----------------------------
  final kbHits = <GlobalSearchHit>[];
  for (final slug in kb.index.search(query)) {
    final a = kb.articles[slug];
    if (a == null) continue;
    kbHits.add(GlobalSearchHit(
      source: SearchSource.kbArticle,
      title: a.title,
      subtitle: a.categoryTitle,
      icon: Icons.menu_book_outlined,
      target: RouteTarget('/knowledge/article/${Uri.encodeComponent(slug)}'),
    ));
  }

  // --- Jobs (contains over title/faction/skill) ------------------------------
  final jobHits = <GlobalSearchHit>[];
  for (final job in jobsRepo.all) {
    final ally = JobTaxonomies.lookup(job.factionRep)?.label ?? '';
    final rival = JobTaxonomies.lookup(job.factionRival)?.label ?? '';
    final hay = <String>[
      job.typeRaw,
      job.description,
      ally,
      rival,
      job.requiredSkill ?? '',
      job.requiredTag ?? '',
      '#${job.id}',
    ].join(' ').toLowerCase();
    if (!hay.contains(q)) continue;
    jobHits.add(GlobalSearchHit(
      source: SearchSource.job,
      title: _jobTitle(job),
      subtitle: _jobSubtitle(job),
      icon: Icons.work_outline,
      target: JobTarget(job),
    ));
  }

  // --- Wallets (existing owner/wallet substring match) -----------------------
  final walletRes = wallet.search(query);
  final walletHits = <GlobalSearchHit>[];
  for (final owner in walletRes.ownerHits) {
    walletHits.add(GlobalSearchHit(
      source: SearchSource.wallet,
      title: owner.displayName,
      subtitle:
          '${owner.wallets.length} wallet${owner.wallets.length == 1 ? '' : 's'}',
      icon: Icons.person_outline,
      target: WalletTarget(query),
    ));
  }
  final ownerIds = walletRes.ownerHits.map((e) => e.id).toSet();
  for (final hit in walletRes.walletHits) {
    if (ownerIds.contains(hit.owner.id)) continue;
    walletHits.add(GlobalSearchHit(
      source: SearchSource.wallet,
      title: hit.wallet,
      subtitle: 'Registered to ${hit.owner.displayName}',
      icon: Icons.account_balance_wallet_outlined,
      target: WalletTarget(query),
    ));
  }

  // --- Captures: notes + links (contains over title/body) --------------------
  final captureHits = <GlobalSearchHit>[];
  for (final n in notes) {
    if (!'${n.title} ${n.body}'.toLowerCase().contains(q)) continue;
    captureHits.add(GlobalSearchHit(
      source: SearchSource.capture,
      title: n.title.trim().isEmpty ? 'Untitled note' : n.title,
      subtitle: _snippet(n.body),
      icon: Icons.sticky_note_2_outlined,
      target: RouteTarget('/captures/note/${Uri.encodeComponent(n.id)}'),
    ));
  }
  for (final l in links) {
    if (!'${l.title} ${l.url} ${l.note}'.toLowerCase().contains(q)) continue;
    captureHits.add(GlobalSearchHit(
      source: SearchSource.capture,
      title: l.title.trim().isEmpty ? l.url : l.title,
      subtitle: l.url,
      icon: Icons.link,
      target: RouteTarget('/captures/link/${Uri.encodeComponent(l.id)}'),
    ));
  }

  // --- Map pins: personal per-zone notes (contains over note) ----------------
  final pinHits = <GlobalSearchHit>[];
  for (final p in pins) {
    if (!p.note.toLowerCase().contains(q)) continue;
    pinHits.add(GlobalSearchHit(
      source: SearchSource.mapPin,
      title: _snippet(p.note),
      subtitle: 'Pinned zone note',
      icon: Icons.push_pin_outlined,
      target: RouteTarget(
        '/knowledge/maps/${Uri.encodeComponent(p.mapId)}'
        '?zone=${Uri.encodeComponent(p.zoneId)}',
      ),
    ));
  }

  return <SearchSource, List<GlobalSearchHit>>{
    SearchSource.mapZone: mapZoneHits,
    SearchSource.kbArticle: kbHits,
    SearchSource.job: jobHits,
    SearchSource.wallet: walletHits,
    SearchSource.capture: captureHits,
    SearchSource.mapPin: pinHits,
  };
});
