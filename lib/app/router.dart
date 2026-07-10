import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/boot/boot_screen.dart';
import '../features/onboarding/onboarding_view.dart';
import '../services/app_settings.dart';
import '../features/captures/views/captures_home_view.dart';
import '../features/captures/views/link_detail_view.dart';
import '../features/captures/views/note_detail_view.dart';
import '../features/hangar/views/hangar_list_view.dart';
import '../features/knowledge/maps/views/map_detail_view.dart';
import '../features/knowledge/maps/views/maps_gallery_view.dart';
import '../features/knowledge/views/kb_article_view.dart';
import '../features/knowledge/views/kb_category_view.dart';
import '../features/knowledge/views/kb_home_view.dart';
import '../features/menu/views/about_view.dart';
import '../features/menu/views/contact_view.dart';
import '../features/menu/views/disclaimer_view.dart';
import '../features/menu/views/faq_view.dart';
import '../features/menu/views/menu_view.dart';
import '../features/menu/views/settings_view.dart';
import '../features/tools/asteroid/views/asteroid_analyzer_view.dart';
import '../features/tools/celestial/views/celestial_view.dart';
import '../features/tools/fishing/views/fishing_map_view.dart';
import '../features/tools/jobs/views/jobs_view.dart';
import '../features/tools/scan/views/system_scan_view.dart';
import '../features/tools/tools_home_view.dart';
import '../features/tools/tracker/domain/tracker_models.dart';
import '../features/tools/tracker/views/tracker_view.dart';
import '../features/tools/train/views/mars_express_view.dart';
import '../features/tools/wallet/views/wallet_lookup_view.dart';
import 'app_shell.dart';

GoRouter buildRouter() {
  final captures = GlobalKey<NavigatorState>(debugLabel: 'captures');
  final tools = GlobalKey<NavigatorState>(debugLabel: 'tools');
  final hangar = GlobalKey<NavigatorState>(debugLabel: 'hangar');
  final knowledge = GlobalKey<NavigatorState>(debugLabel: 'knowledge');
  final menu = GlobalKey<NavigatorState>(debugLabel: 'menu');
  final root = GlobalKey<NavigatorState>(debugLabel: 'root');

  return GoRouter(
    initialLocation: '/boot',
    navigatorKey: root,
    // A deep link to a path we don't recognise (e.g. a renamed/removed route)
    // lands on a real dead-end screen with a way back, never a blank spinner.
    errorBuilder: (context, state) => _RouteNotFound(location: state.uri.path),
    routes: [
      GoRoute(
        path: '/boot',
        builder: (context, state) => BootScreen(
          onComplete: () {
            // First run only: send new pilots through the onboarding
            // transmission before the main app; returning users skip it.
            final seen = ProviderScope.containerOf(context, listen: false)
                .read(appSettingsProvider)
                .onboardingSeen;
            context.go(seen ? '/tools' : '/onboarding');
          },
        ),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingView(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navShell) => AppShell(navigationShell: navShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: tools,
            routes: [
              GoRoute(
                path: '/tools',
                builder: (context, state) => const ToolsHomeView(),
                routes: [
                  GoRoute(
                    path: 'scan',
                    builder: (context, state) => const SystemScanView(),
                  ),
                  GoRoute(
                    path: 'asteroid',
                    builder: (context, state) => const AsteroidAnalyzerView(),
                  ),
                  GoRoute(
                    path: 'wallet',
                    builder: (context, state) => const WalletLookupView(),
                  ),
                  GoRoute(
                    path: 'mars-express',
                    builder: (context, state) => const MarsExpressView(),
                  ),
                  GoRoute(
                    path: 'fishing',
                    builder: (context, state) => const FishingMapView(),
                    routes: [
                      GoRoute(
                        path: ':roomId',
                        builder: (context, state) => FishingRoomView(
                          roomId: state.pathParameters['roomId']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'tracker',
                    builder: (context, state) => TrackerView(
                      prefill: state.extra is TrackTarget
                          ? state.extra as TrackTarget
                          : null,
                    ),
                  ),
                  GoRoute(
                    path: 'discoveries',
                    builder: (context, state) => const CelestialView(),
                  ),
                  GoRoute(
                    path: 'jobs',
                    builder: (context, state) => const JobsView(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: captures,
            routes: [
              GoRoute(
                path: '/captures',
                builder: (context, state) => const CapturesHomeView(),
                routes: [
                  GoRoute(
                    path: 'note/:id',
                    builder: (context, state) =>
                        NoteDetailView(noteId: state.pathParameters['id']!),
                  ),
                  GoRoute(
                    path: 'link/:id',
                    builder: (context, state) =>
                        LinkDetailView(linkId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: hangar,
            routes: [
              GoRoute(
                path: '/hangar',
                builder: (context, state) => const HangarListView(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: knowledge,
            routes: [
              GoRoute(
                path: '/knowledge',
                builder: (context, state) => const KBHomeView(),
                routes: [
                  GoRoute(
                    path: 'category/:id',
                    builder: (context, state) =>
                        KBCategoryView(categoryId: state.pathParameters['id']!),
                  ),
                  GoRoute(
                    path: 'article/:slug',
                    builder: (context, state) => KBArticleView(
                      slug: state.pathParameters['slug']!,
                    ),
                  ),
                  GoRoute(
                    path: 'maps',
                    builder: (context, state) => const MapsGalleryView(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        // MapDetailView renders a real "map not found" pane when
                        // the id no longer resolves in the installed manifest —
                        // a stale deep link never spins forever (audit fallback).
                        builder: (context, state) => MapDetailView(
                          id: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: menu,
            routes: [
              GoRoute(
                path: '/menu',
                builder: (context, state) => const MenuView(),
                routes: [
                  GoRoute(
                    path: 'settings',
                    builder: (context, state) => const SettingsView(),
                  ),
                  GoRoute(
                    path: 'about',
                    builder: (context, state) => const AboutView(),
                  ),
                  GoRoute(
                    path: 'faq',
                    builder: (context, state) => const FAQView(),
                  ),
                  GoRoute(
                    path: 'disclaimer',
                    builder: (context, state) => const DisclaimerView(),
                  ),
                  GoRoute(
                    path: 'contact',
                    builder: (context, state) => const ContactView(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// Terminal fallback for an unmatched route (bad/stale deep link). Kept
/// dependency-light on purpose so it renders even if a feature is unavailable.
class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Not found')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.explore_off, size: 40),
              const SizedBox(height: 12),
              Text(
                "This screen doesn't exist.",
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                location,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go('/tools'),
                child: const Text('Back to Underdeck'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
