import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '../../../../design-system/components/AppBackground';
import { HowItWorksSheet } from '../../../../design-system/components/HowItWorksSheet';
import { PageScrollView } from '../../../../design-system/components/PageScrollView';
import { IconArrowBack, IconInfoOutline } from '../../../../design-system/icons';
import { createScrollOffsetStore, ScrollOffsetContext } from '../../../../design-system/scrollOffset';
import { IconHistory } from './toolIcons';
import styles from './nasa.module.css';

/**
 * Shared chrome for the three tool screens (spec §1.5): transparent app bar
 * over the page background with a back arrow, centered title, and the info +
 * history action buttons; a scroll-offset scope so the in-content
 * TransmissionHeader counter ticks; and the How-it-works sheet host.
 */
export function ToolScaffold({
  title,
  historyTooltip,
  renderHowItWorks,
  renderHistory,
  children,
}: {
  title: string;
  historyTooltip: string;
  renderHowItWorks: () => ReactNode;
  renderHistory: (close: () => void) => ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconBtn}
                title="How this tool works"
                aria-label="How this tool works"
                onClick={() => setInfoOpen(true)}
              >
                <IconInfoOutline size={22} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title={historyTooltip}
                aria-label={historyTooltip}
                onClick={() => setHistoryOpen(true)}
              >
                <IconHistory size={22} />
              </button>
            </div>
          </div>
          <PageScrollView padding="64px 12px 32px">
            <div className={styles.stack}>{children}</div>
          </PageScrollView>
        </div>
      </AppBackground>
      <HowItWorksSheet open={infoOpen} onClose={() => setInfoOpen(false)}>
        {infoOpen ? renderHowItWorks() : null}
      </HowItWorksSheet>
      {historyOpen ? renderHistory(() => setHistoryOpen(false)) : null}
    </ScrollOffsetContext.Provider>
  );
}
