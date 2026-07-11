import { PendingSubPage } from '../common/PendingPages';

/**
 * /knowledge/maps/:id — one interactive map; ?zone= pre-selects a zone.
 * Must render a real "map not found" pane for stale ids when implemented.
 */
export function MapDetailView() {
  return <PendingSubPage title="Map" />;
}
