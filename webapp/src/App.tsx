import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AboutView } from './app/AboutView';
import { AppShell } from './app/AppShell';
import { BootScreen } from './app/BootScreen';
import { ContactView } from './app/ContactView';
import { DisclaimerView } from './app/DisclaimerView';
import { FAQView } from './app/FAQView';
import { MenuView } from './app/MenuView';
import { Onboarding } from './app/Onboarding';
import { RouteNotFound } from './app/RouteNotFound';
import { SettingsView } from './app/SettingsView';
import { SnackbarHost } from './design-system/components/SnackbarHost';
import { CapturesHomeView } from './features/captures/CapturesHomeView';
import { LinkDetailView } from './features/captures/LinkDetailView';
import { NoteDetailView } from './features/captures/NoteDetailView';
import { HangarListView } from './features/hangar/HangarListView';
import { KBArticleView } from './features/knowledge/KBArticleView';
import { KBCategoryView } from './features/knowledge/KBCategoryView';
import { KBHomeView } from './features/knowledge/KBHomeView';
import { MapDetailView } from './features/knowledge/MapDetailView';
import { MapsGalleryView } from './features/knowledge/MapsGalleryView';
import { GlobalSearchView } from './features/search/GlobalSearchView';
import { AsteroidAnalyzerView } from './features/tools/AsteroidAnalyzerView';
import { CelestialView } from './features/tools/CelestialView';
import { FishingMapView } from './features/tools/FishingMapView';
import { FishingRoomView } from './features/tools/FishingRoomView';
import { JobsView } from './features/tools/JobsView';
import { MarsExpressView } from './features/tools/MarsExpressView';
import { SystemScanView } from './features/tools/SystemScanView';
import { ToolsHomeView } from './features/tools/ToolsHomeView';
import { TrackerView } from './features/tools/TrackerView';
import { WalletLookupView } from './features/tools/WalletLookupView';

/** Complete route table (app-shell spec §3.1). Initial location: /boot. */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/boot" replace />} />
        <Route path="/boot" element={<BootScreen />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<AppShell />}>
          {/* Tab 0 — Tools */}
          <Route path="/tools" element={<ToolsHomeView />} />
          <Route path="/tools/scan" element={<SystemScanView />} />
          <Route path="/tools/asteroid" element={<AsteroidAnalyzerView />} />
          <Route path="/tools/wallet" element={<WalletLookupView />} />
          <Route path="/tools/mars-express" element={<MarsExpressView />} />
          <Route path="/tools/fishing" element={<FishingMapView />} />
          <Route path="/tools/fishing/:roomId" element={<FishingRoomView />} />
          <Route path="/tools/tracker" element={<TrackerView />} />
          <Route path="/tools/discoveries" element={<CelestialView />} />
          <Route path="/tools/jobs" element={<JobsView />} />

          {/* Tab 1 — Notes/Captures */}
          <Route path="/captures" element={<CapturesHomeView />} />
          <Route path="/captures/note/:id" element={<NoteDetailView />} />
          <Route path="/captures/link/:id" element={<LinkDetailView />} />

          {/* Tab 2 — Hangar */}
          <Route path="/hangar" element={<HangarListView />} />

          {/* Tab 3 — Knowledge */}
          <Route path="/knowledge" element={<KBHomeView />} />
          <Route path="/knowledge/category/:id" element={<KBCategoryView />} />
          <Route path="/knowledge/article/:slug" element={<KBArticleView />} />
          <Route path="/knowledge/maps" element={<MapsGalleryView />} />
          <Route path="/knowledge/maps/:id" element={<MapDetailView />} />

          {/* Tab 4 — Menu */}
          <Route path="/menu" element={<MenuView />} />
          <Route path="/menu/search" element={<GlobalSearchView />} />
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
