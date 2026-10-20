import { lazy, type ComponentType } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { BootScreen } from './app/BootScreen';
import { Onboarding } from './app/Onboarding';
import { RouteNotFound } from './app/RouteNotFound';
import { SnackbarHost } from './design-system/components/SnackbarHost';
import { ToolsHomeView } from './features/tools/ToolsHomeView';

/**
 * Every screen but the first ones (boot, onboarding, Tools home) is its own
 * chunk, loaded when opened: the app's first download and start-up stay small.
 * The service worker still precaches every chunk, so offline is unchanged;
 * AppShell shows a spinner while a chunk loads.
 */
function screen<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const AboutView = screen(() => import('./app/AboutView'), 'AboutView');
const ContactView = screen(() => import('./app/ContactView'), 'ContactView');
const DisclaimerView = screen(() => import('./app/DisclaimerView'), 'DisclaimerView');
const FAQView = screen(() => import('./app/FAQView'), 'FAQView');
const MenuView = screen(() => import('./app/MenuView'), 'MenuView');
const SettingsView = screen(() => import('./app/SettingsView'), 'SettingsView');
const CapturesHomeView = screen(() => import('./features/captures/CapturesHomeView'), 'CapturesHomeView');
const LinkDetailView = screen(() => import('./features/captures/LinkDetailView'), 'LinkDetailView');
const NoteDetailView = screen(() => import('./features/captures/NoteDetailView'), 'NoteDetailView');
const FavoritesView = screen(() => import('./features/favorites/FavoritesView'), 'FavoritesView');
const HangarListView = screen(() => import('./features/hangar/HangarListView'), 'HangarListView');
const KBArticleView = screen(() => import('./features/knowledge/KBArticleView'), 'KBArticleView');
const KBCategoryView = screen(() => import('./features/knowledge/KBCategoryView'), 'KBCategoryView');
const KBHomeView = screen(() => import('./features/knowledge/KBHomeView'), 'KBHomeView');
const MapDetailView = screen(() => import('./features/knowledge/MapDetailView'), 'MapDetailView');
const GlobalSearchView = screen(() => import('./features/search/GlobalSearchView'), 'GlobalSearchView');
const AsteroidAnalyzerView = screen(() => import('./features/tools/AsteroidAnalyzerView'), 'AsteroidAnalyzerView');
const CelestialView = screen(() => import('./features/tools/CelestialView'), 'CelestialView');
const FishingMapView = screen(() => import('./features/tools/FishingMapView'), 'FishingMapView');
const FishingRoomView = screen(() => import('./features/tools/FishingRoomView'), 'FishingRoomView');
const FoeDecoderView = screen(() => import('./features/tools/FoeDecoderView'), 'FoeDecoderView');
const JobsView = screen(() => import('./features/tools/JobsView'), 'JobsView');
const MarsExpressView = screen(() => import('./features/tools/MarsExpressView'), 'MarsExpressView');
const SystemScanView = screen(() => import('./features/tools/SystemScanView'), 'SystemScanView');
const TrackerView = screen(() => import('./features/tools/TrackerView'), 'TrackerView');
const WalletLookupView = screen(() => import('./features/tools/WalletLookupView'), 'WalletLookupView');

/** Complete route table (app-shell spec §3.1). Initial location: /boot. */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/boot" replace />} />
        <Route path="/boot" element={<BootScreen />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<AppShell />}>
          {/* Tab 0 - Tools */}
          <Route path="/tools" element={<ToolsHomeView />} />
          <Route path="/tools/scan" element={<SystemScanView />} />
          <Route path="/tools/asteroid" element={<AsteroidAnalyzerView />} />
          <Route path="/tools/foe" element={<FoeDecoderView />} />
          <Route path="/tools/wallet" element={<WalletLookupView />} />
          <Route path="/tools/mars-express" element={<MarsExpressView />} />
          <Route path="/tools/fishing" element={<FishingMapView />} />
          <Route path="/tools/fishing/:roomId" element={<FishingRoomView />} />
          <Route path="/tools/tracker" element={<TrackerView />} />
          <Route path="/tools/discoveries" element={<CelestialView />} />
          <Route path="/tools/jobs" element={<JobsView />} />

          {/* Tab 1 - Notes/Captures */}
          <Route path="/captures" element={<CapturesHomeView />} />
          <Route path="/captures/note/:id" element={<NoteDetailView />} />
          <Route path="/captures/link/:id" element={<LinkDetailView />} />

          {/* Tab 2 - Hangar */}
          <Route path="/hangar" element={<HangarListView />} />

          {/* Tab 3 - Knowledge */}
          <Route path="/knowledge" element={<KBHomeView />} />
          <Route path="/knowledge/category/:id" element={<KBCategoryView />} />
          <Route path="/knowledge/article/:slug" element={<KBArticleView />} />
          <Route path="/knowledge/maps/:id" element={<MapDetailView />} />

          {/* Tab 4 - Menu */}
          <Route path="/menu" element={<MenuView />} />
          <Route path="/menu/search" element={<GlobalSearchView />} />
          <Route path="/menu/favorites" element={<FavoritesView />} />
          <Route path="/menu/settings" element={<SettingsView />} />
          <Route path="/menu/about" element={<AboutView />} />
          <Route path="/menu/faq" element={<FAQView />} />
          <Route path="/menu/disclaimer" element={<DisclaimerView />} />
          <Route path="/menu/contact" element={<ContactView />} />
        </Route>

        <Route path="*" element={<RouteNotFound />} />
      </Routes>
      <SnackbarHost />
    </HashRouter>
  );
}
