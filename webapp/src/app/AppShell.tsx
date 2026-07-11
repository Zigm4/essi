import { Outlet } from 'react-router-dom';
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
  return (
    <div className={styles.shell}>
      <SideNav />
      <div className={styles.content}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
