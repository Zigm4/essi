import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { Haptics } from '../../core/haptics';
import { IconArrowUpward } from '../icons';
import { ScrollOffsetContext } from '../scrollOffset';
import { useReducedMotion } from '../reducedMotion';
import styles from './PageScrollView.module.css';

/** Per-route scroll positions so each tab/page keeps its scroll state. */
const savedScrollPositions = new Map<string, number>();

/**
 * Drop-in scroll wrapper (design-system spec §6.3): broadcasts its offset to
 * the nearest ScrollOffsetScope, restores per-route scroll position and shows
 * a floating back-to-top button after one viewport height.
 */
export function PageScrollView({
  padding,
  className,
  children,
}: {
  padding?: string;
  className?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  const store = useContext(ScrollOffsetContext);
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const saved = savedScrollPositions.get(location.pathname);
    if (saved !== undefined) {
      el.scrollTop = saved;
      store?.set(saved);
      setShowTop(saved > el.clientHeight);
    }
    return () => {
      store?.set(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el === null) return;
    store?.set(el.scrollTop);
    savedScrollPositions.set(location.pathname, el.scrollTop);
    setShowTop(el.scrollTop > el.clientHeight);
  };

  const scrollToTop = () => {
    Haptics.tap();
    scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  const contentStyle: CSSProperties = {};
  if (padding !== undefined) contentStyle.padding = padding;

  return (
    <div className={styles.wrapper}>
      <div
        ref={scrollRef}
        className={`${styles.scroll} ${className ?? ''}`}
        style={contentStyle}
        onScroll={onScroll}
      >
        {children}
      </div>
      <button
        type="button"
        className={`${styles.backToTop} ${showTop ? styles.backToTopVisible : ''}`}
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <IconArrowUpward size={22} />
      </button>
    </div>
  );
}
