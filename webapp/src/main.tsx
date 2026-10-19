import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/fonts.css';
import './design-system/tokens.css';
import { installGlobalErrorHandlers } from './core/logging';
import { safeRemoveItem } from './core/safeStorage';
import { ErrorBoundary } from './app/ErrorBoundary';
import { registerServiceWorker } from './app/registerServiceWorker';
import App from './App';

installGlobalErrorHandlers();

// Leftovers of the removed Mars Express zone alerts (Oct 2026).
for (const key of ['underdeck.trainAlert.zones', 'underdeck.trainAlert.armed', 'underdeck.trainAlert.didLegacyCleanup']) {
  safeRemoveItem(key);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
