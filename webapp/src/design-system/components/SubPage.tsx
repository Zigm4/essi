import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { PageScrollView } from './PageScrollView';
import { IconArrowBack } from '../icons';
import styles from './SubPage.module.css';

/**
 * Sub-page chrome shared by Settings/About/FAQ/Disclaimer/Contact
 * (app-shell spec §8): transparent app bar over the page background,
 * back icon tinted accentPrimary, body padded below the toolbar.
 */
export function SubPage({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <AppBackground>
      <div className={styles.page}>
        <div className={styles.appBar}>
          <button
            type="button"
            className={styles.back}
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <IconArrowBack size={24} />
          </button>
          <span className={styles.title}>{title}</span>
        </div>
        <PageScrollView padding="64px 12px 32px">
          <div className={styles.stack}>{children}</div>
        </PageScrollView>
      </div>
    </AppBackground>
  );
}
