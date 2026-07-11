import { useRef, type ReactNode } from 'react';
import { createScrollOffsetStore, ScrollOffsetContext } from '../scrollOffset';
import { AppBackground } from './AppBackground';
import { TransmissionHeader } from './TransmissionHeader';
import styles from './BannerPage.module.css';

/**
 * Layout scaffold for main shell pages (design-system spec §6.2):
 * AppBackground + pinned TransmissionHeader + scrollable body. Content
 * scrolls BETWEEN the banner and the bottom nav, never behind either.
 */
export function BannerPage({
  bannerLabel,
  bannerActions,
  children,
}: {
  bannerLabel: string;
  bannerActions?: ReactNode;
  children: ReactNode;
}) {
  const storeRef = useRef(createScrollOffsetStore());
  return (
    <ScrollOffsetContext.Provider value={storeRef.current}>
      <AppBackground>
        <div className={styles.page}>
          <TransmissionHeader label={bannerLabel} actions={bannerActions} />
          <div className={styles.body}>{children}</div>
        </div>
      </AppBackground>
    </ScrollOffsetContext.Provider>
  );
}
