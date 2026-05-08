import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/boot/boot_screen.dart';
import '../features/captures/views/captures_home_view.dart';
import '../features/captures/views/link_detail_view.dart';
import '../features/captures/views/note_detail_view.dart';
import '../features/hangar/views/hangar_list_view.dart';
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
import '../features/tools/fishing/views/fishing_map_view.dart';
import '../features/tools/scan/views/system_scan_view.dart';
import '../features/tools/tools_home_view.dart';
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
    routes: [
      GoRoute(
        path: '/boot',
        builder: (context, state) => BootScreen(
          onComplete: () => context.go('/captures'),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navShell) => AppShell(navigationShell: navShell),
        branches: [
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
