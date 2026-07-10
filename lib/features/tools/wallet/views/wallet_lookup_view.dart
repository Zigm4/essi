import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:underdeck_app/core/error_text.dart';
import 'package:underdeck_app/core/logging.dart';

import '../../../../services/haptics.dart';
import '../../../../services/share_card.dart';
import '../widgets/wallet_share_card.dart';

import '../../../../design_system/colors.dart';
import '../../../../design_system/components/app_background.dart';
import '../../../../design_system/components/glass_card.dart';
import '../../../../design_system/components/page_scroll_view.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';

class WalletEntry {
  final String displayName;
  final String? discordUsername;
  final List<String> wallets;

  const WalletEntry({
    required this.displayName,
    this.discordUsername,
    required this.wallets,
  });

  String get id => discordUsername ?? displayName;

  factory WalletEntry.fromJson(Map<String, dynamic> j) => WalletEntry(
    displayName: j['display_name'] as String,
    discordUsername: j['discord_username'] as String?,
    wallets: ((j['wallets'] as List<dynamic>?) ?? const [])
        .map((e) => e as String)
        .toList(),
  );
}

class WalletData {
  final List<WalletEntry> entries;
  const WalletData(this.entries);

  int get totalOwners => entries.length;
  int get totalWallets => entries.fold(0, (a, e) => a + e.wallets.length);

  ({List<WalletEntry> ownerHits, List<({String wallet, WalletEntry owner})> walletHits})
      search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      return (ownerHits: const [], walletHits: const []);
    }
    final owners = <WalletEntry>[];
    final wallets = <({String wallet, WalletEntry owner})>[];
    for (final e in entries) {
      final nameMatch = e.displayName.toLowerCase().contains(q) ||
          (e.discordUsername?.toLowerCase().contains(q) ?? false);
      if (nameMatch) owners.add(e);
      for (final w in e.wallets) {
        if (w.toLowerCase().contains(q)) {
          wallets.add((wallet: w, owner: e));
        }
      }
    }
    return (ownerHits: owners, walletHits: wallets);
  }

  static Future<WalletData> load() async {
    try {
      final raw = await rootBundle.loadString('assets/catalog/wallets.json');
      final list = (jsonDecode(raw) as List<dynamic>)
          .map((e) => WalletEntry.fromJson(e as Map<String, dynamic>))
          .toList();
      return WalletData(list);
    } catch (e, st) {
      logError('Failed to load assets/catalog/wallets.json: $e', st);
      rethrow;
    }
  }
}

final walletDataProvider = FutureProvider<WalletData>((ref) {
  return WalletData.load();
});

// autoDispose so re-entering the screen starts from an empty query, matching
// the freshly-built (controller-less) search field instead of showing stale
// results under a blank box.
final walletQueryProvider = StateProvider.autoDispose<String>((ref) => '');

class WalletLookupView extends ConsumerStatefulWidget {
  const WalletLookupView({super.key, this.initialQuery});

  /// Optional query to pre-seed the lookup with (e.g. handed in from global
  /// search via the `?q=` route param). Null / blank starts on the overview.
  final String? initialQuery;

  @override
  ConsumerState<WalletLookupView> createState() => _WalletLookupViewState();
}

class _WalletLookupViewState extends ConsumerState<WalletLookupView> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final seed = widget.initialQuery?.trim() ?? '';
    _controller = TextEditingController(text: seed);
    if (seed.isNotEmpty) {
      // Seed the (autoDispose) query provider once the first frame is up so the
      // results section renders the incoming query immediately.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(walletQueryProvider.notifier).state = seed;
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(walletDataProvider);
    final query = ref.watch(walletQueryProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Wallet Lookup', style: AppTypography.headline),
        iconTheme: const IconThemeData(color: AppColors.accentPrimary),
      ),
      body: AppBackground(
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              friendlyError(e, fallback: "Couldn't load wallet data."),
              style: AppTypography.body.copyWith(color: AppColors.accentDanger),
            ),
          ),
          data: (data) => PageScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              MediaQuery.paddingOf(context).top +
                  kToolbarHeight +
                  AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const TransmissionHeader(label: 'ESBE · blockchain analysis'),
                const SizedBox(height: AppSpacing.lg),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionHeader(title: 'Search owner or wallet'),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Find a wallet from an owner handle, or an owner from a wallet.',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Search…',
                          hintStyle: AppTypography.mono.copyWith(
                            color: AppColors.textDim,
                          ),
                          border: UnderlineInputBorder(
                            borderSide: BorderSide(color: AppColors.borderGlow),
                          ),
                          enabledBorder: UnderlineInputBorder(
                            borderSide: BorderSide(color: AppColors.borderGlow),
                          ),
                          focusedBorder: UnderlineInputBorder(
                            borderSide:
                                BorderSide(color: AppColors.borderGlow, width: 2),
                          ),
                        ),
                        style: AppTypography.mono.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textPrimary,
                        ),
                        autocorrect: false,
                        enableSuggestions: false,
                        inputFormatters: const [],
                        onChanged: (v) =>
                            ref.read(walletQueryProvider.notifier).state = v,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (query.trim().isEmpty)
                  _OverviewCard(data: data)
                else
                  _ResultsSection(data: data, query: query),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({required this.data});
  final WalletData data;

  @override
  Widget build(BuildContext context) {
    final avg = data.totalOwners == 0
        ? 0.0
        : data.totalWallets / data.totalOwners;
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Database overview', icon: Icons.bar_chart),
          const SizedBox(height: AppSpacing.sm),
          _StatRow(label: 'Owners', value: '${data.totalOwners}'),
          _StatRow(label: 'Wallets', value: '${data.totalWallets}'),
          _StatRow(
            label: 'Avg per owner',
            value: avg.toStringAsFixed(1),
          ),
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppTypography.caption)),
          Text(
            value,
            style: AppTypography.mono.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.accentSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultsSection extends ConsumerWidget {
  const _ResultsSection({required this.data, required this.query});
  final WalletData data;
  final String query;

  static const _maxVisible = 50;

  Future<void> _share({
    required BuildContext context,
    required WidgetRef ref,
    required List<WalletEntry> ownerHits,
    required List<({String wallet, WalletEntry owner})> walletHits,
  }) async {
    Haptics.of(ref).tap();
    final ok = await ShareCardCapture.share(
      context: context,
      card: WalletShareCard(
        query: query,
        ownerHits: ownerHits,
        walletHits: walletHits,
      ),
      fileName:
          'underdeck-wallet-${DateTime.now().millisecondsSinceEpoch}.png',
      text: 'Underdeck wallet lookup',
      sharePositionOrigin: ShareCardCapture.originRectFor(context),
    );
    if (!ok && context.mounted) {
      ShareCardCapture.showShareFailure(context);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = data.search(query);
    final ownerIds = r.ownerHits.map((e) => e.id).toSet();
    final extraWallets =
        r.walletHits.where((h) => !ownerIds.contains(h.owner.id)).toList();
    final total = r.ownerHits.length + extraWallets.length;
    final visibleOwners = r.ownerHits.take(_maxVisible).toList();
    final remaining = (_maxVisible - visibleOwners.length).clamp(0, _maxVisible);
    final visibleWallets = extraWallets.take(remaining).toList();
    final hidden =
        total - visibleOwners.length - visibleWallets.length;

    if (total == 0) {
      return GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.search, color: AppColors.accentWarn),
                const SizedBox(width: AppSpacing.sm),
                Text('No matches', style: AppTypography.headline),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Try a different name, Discord handle, or wallet substring.',
              style: AppTypography.caption,
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: SectionHeader(
                title: '$total result${total == 1 ? '' : 's'}',
                icon: Icons.list,
              ),
            ),
            IconButton(
              onPressed: () => _share(
                context: context,
                ref: ref,
                ownerHits: r.ownerHits,
                walletHits: r.walletHits,
              ),
              icon: const Icon(Icons.ios_share,
                  color: AppColors.accentPrimary, size: 18),
              tooltip: 'Share results',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final owner in visibleOwners) ...[
          _OwnerCard(entry: owner),
          const SizedBox(height: AppSpacing.md),
        ],
        if (visibleWallets.isNotEmpty) ...[
          const SectionHeader(
            title: 'Wallet matches',
            icon: Icons.wallet,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final hit in visibleWallets) ...[
            _WalletHitCard(wallet: hit.wallet, owner: hit.owner),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
        if (hidden > 0)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'Showing ${visibleOwners.length + visibleWallets.length} of $total matches — refine your search to narrow down.',
              style: AppTypography.caption,
            ),
          ),
      ],
    );
  }
}

class _OwnerCard extends StatelessWidget {
  const _OwnerCard({required this.entry});
  final WalletEntry entry;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person, color: AppColors.accentPrimary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.displayName, style: AppTypography.headline),
                    if (entry.discordUsername != null &&
                        entry.discordUsername!.toLowerCase() !=
                            entry.displayName.toLowerCase())
                      Text(
                        '@${entry.discordUsername}',
                        style: AppTypography.mono.copyWith(
                          fontSize: 12,
                          color: AppColors.accentSecondary,
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                '${entry.wallets.length} wallet${entry.wallets.length == 1 ? '' : 's'}',
                style: AppTypography.caption,
              ),
            ],
          ),
          if (entry.wallets.isNotEmpty) ...[
            Container(
              height: 1,
              margin: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              color: AppColors.borderSubtle,
            ),
            for (final wallet in entry.wallets)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    const Icon(Icons.wallet,
                        color: AppColors.accentSecondary, size: 16),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: SelectableText(
                        wallet,
                        style: AppTypography.mono.copyWith(
                          fontSize: 13,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _WalletHitCard extends StatelessWidget {
  const _WalletHitCard({required this.wallet, required this.owner});
  final String wallet;
  final WalletEntry owner;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.wallet, color: AppColors.accentSecondary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SelectableText(
                  wallet,
                  style: AppTypography.mono.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('Registered to ', style: AppTypography.caption),
              Text(
                owner.displayName,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentPrimary,
                ),
              ),
              if (owner.discordUsername != null &&
                  owner.discordUsername!.toLowerCase() !=
                      owner.displayName.toLowerCase())
                Text(
                  ' (@${owner.discordUsername})',
                  style: AppTypography.mono.copyWith(
                    fontSize: 12,
                    color: AppColors.accentSecondary,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
