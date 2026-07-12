import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../../../design-system/components/AppBackground';
import { PageScrollView } from '../../../design-system/components/PageScrollView';
import { IconArrowBack } from '../../../design-system/icons';
import styles from './DetailScaffold.module.css';

/**
 * Detail-view chrome (knowledge spec §2): a transparent app bar drawn OVER the
 * page background - content scrolls behind it. Back arrow tinted accentPrimary,
 * centered headline title, an optional trailing action (e.g. bookmark toggle).
 * `bodyPadding` sets the scroll padding (top = safe-area + toolbar(56) + 8).
 */
export function DetailScaffold({
  title,
  action,
  bodyPadding,
  children,
}: {
  title: string;
  action?: ReactNode;
  bodyPadding: string;
  children: ReactNode;
}) {
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
          <span className={styles.action}>{action}</span>
        </div>
        <PageScrollView padding={bodyPadding}>{children}</PageScrollView>
      </div>
    </AppBackground>
  );
}
