import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../../../design-system/components/AppBackground';
import { PageScrollView } from '../../../design-system/components/PageScrollView';
import { IconArrowBack } from '../../../design-system/icons';
import styles from './DetailScaffold.module.css';

/**
 * Detail-page chrome for Note/Link detail (spec §10/§11): AppBackground WITH
 * scanlines (default), transparent app bar over the body with an accent back
 * arrow, centered title and an `Edit` action, and a padded PageScrollView body.
 */
export function DetailScaffold({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
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
          <button type="button" className={styles.edit} onClick={onEdit}>
            Edit
          </button>
        </div>
        <PageScrollView padding="64px 12px 32px">{children}</PageScrollView>
      </div>
    </AppBackground>
  );
}
