import { useLocation, useNavigate } from 'react-router-dom';
import { NeonButton } from '../design-system/components/NeonButton';
import { SubPage } from '../design-system/components/SubPage';
import { IconExploreOff } from '../design-system/icons';
import styles from './RouteNotFound.module.css';

/** Terminal fallback for a bad/stale deep link (app-shell spec §3.2),
 *  restyled to match the app chrome as the spec's open question recommends. */
export function RouteNotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <SubPage title="Not found">
      <div className={styles.center}>
        <span className={styles.icon}>
          <IconExploreOff size={40} />
        </span>
        <div className={styles.message}>This screen doesn't exist.</div>
        <div className={styles.path}>{location.pathname}</div>
        <NeonButton
          className={styles.button}
          title="Back to Underdeck"
          onPressed={() => navigate('/tools')}
        />
      </div>
    </SubPage>
  );
}
