import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The tab root a route belongs to (`/menu/faq` → `/menu`, `/knowledge/maps/x`
 * → `/knowledge`); the app's routes all live under a tab's first segment.
 */
export function parentTabRoot(pathname: string): string {
  const first = pathname.split('/')[1];
  return first === undefined || first === '' ? '/tools' : `/${first}`;
}

/**
 * Back-button handler for the in-app bars. Steps back through in-app history
 * when there is some; a page opened from a direct link (shared URL, new tab)
 * has none - `navigate(-1)` would do nothing or leave ESSI - so it goes to the
 * page's tab root instead (or `fallback`).
 */
export function useBack(fallback?: string): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback ?? parentTabRoot(pathname), { replace: true });
  }, [navigate, pathname, fallback]);
}
