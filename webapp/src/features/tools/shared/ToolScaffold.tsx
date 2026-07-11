import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../../../design-system/components/AppBackground';
import { PageScrollView } from '../../../design-system/components/PageScrollView';
import { IconArrowBack } from '../../../design-system/icons';
import { createScrollOffsetStore, ScrollOffsetContext } from '../../../design-system/scrollOffset';
import styles from './ToolScaffold.module.css';

/**
 * Sub-page chrome for the AppBar-style tools (Fishing / Mars Express / Wallet /
 * Asteroid): transparent app bar over the page background with an
 * accentPrimary back arrow and a centered title, the body scrolling behind it.
 * Unlike the shared SubPage it also provides a ScrollOffsetScope so an
 * in-content TransmissionHeader's sector counter animates on scroll.
 */
export function ToolScaffold({
  title,
  padding = '64px 12px 32px',
  children,
}: {
  title: string;
  padding?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const storeRef = useRef(createScrollOffsetStore());
  return (
    <ScrollOffsetContext.Provider value={storeRef.current}>
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
          <PageScrollView padding={padding}>{children}</PageScrollView>
        </div>
      </AppBackground>
    </ScrollOffsetContext.Provider>
  );
}
