import { PendingSubPage } from '../common/PendingPages';

/**
 * /tools/tracker — track a comet or asteroid live (JPL Horizons).
 * A prefill TrackTarget arrives via router location state, not the URL.
 */
export function TrackerView() {
  return <PendingSubPage title="Tracker" />;
}
