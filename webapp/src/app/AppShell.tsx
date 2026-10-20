import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CenteredSpinner } from '../features/tools/shared/Status';
import { ErrorBoundary } from './ErrorBoundary';
import { BackupReminderFooter } from './BackupReminderFooter';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import styles from './AppShell.module.css';

/**
 * Responsive shell (app-shell spec §4 + web adaptation):
 * - < 900px: single column with the floating bottom-bar capsule.
 * - >= 900px: persistent left sidebar rail, content fills the rest.
 * Same component tree, routes and per-tab scroll preservation in both;
 * only the nav chrome and content width differ (CSS media query).
 */
export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className={styles.shell}>
      <SideNav />
      <div className={styles.content}>
        {/* A crashing screen shows a recovery card; the nav stays usable and a new path resets it. */}
        <ErrorBoundary key={pathname}>
          {/* Screens load on demand (App.tsx): the nav stays while one arrives. */}
          <Suspense fallback={<CenteredSpinner />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
      {/* Before the nav in the DOM so keyboard focus follows the visual order
          (the CSS grid puts it in the row above the nav). */}
      <BackupReminderFooter />
      <BottomNav />
    </div>
  );
}
