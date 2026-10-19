import { useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { withAlpha } from '../../design-system/color';
import { BottomSheet } from './shared/BottomSheet';
import { useFavoriteSet } from './shared/favorites';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { ZoneSummaryCard } from './fishing/ZoneSummaryCard';
import {
  FISHING_DEPTHS,
  depthCounts,
  depthFromName,
  filterZones,
  isFiltering,
  matchesFilter,
  type FishingRoom,
  type FishingSegment,
  type FishingZone,
} from './fishing/fishingData';
import { useFishingRooms } from './fishing/useFishingData';
import styles from './fishing/Fishing.module.css';

const UNKNOWN_DEPTH_COLOR = '#4F6A87';
const SEGMENTS: readonly { id: FishingSegment; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'depthKnown', label: 'Depth known' },
  { id: 'toDiscover', label: 'To discover' },
  { id: 'reefs', label: 'Reefs' },
];

/** /tools/fishing/:roomId - a single fishing map room. */
export function FishingRoomView() {
  const { roomId } = useParams();
  const { rooms, error } = useFishingRooms();
  const favSet = useFavoriteSet('fishing_zone');
  const room = rooms?.find((r) => r.id === roomId) ?? null;

  return (
    <ToolScaffold title={room?.name ?? ''}>
      {error !== null ? (
        <CenteredError message={error} />
      ) : rooms === null ? (
        <CenteredSpinner />
      ) : room === null ? (
        <div className={styles.notFound}>Room not found</div>
      ) : room.isSolo ? (
        <ZoneSummaryCard
          zone={room.zones[0]!}
          showsZoneNumber={false}
          favorite={favSet.has(String(room.zones[0]!.id))}
        />
      ) : (
        <MultiRoom room={room} favSet={favSet} />
      )}
    </ToolScaffold>
  );
}

function MultiRoom({ room, favSet }: { room: FishingRoom; favSet: Set<string> }) {
  const [segment, setSegment] = useState<FishingSegment>('all');
  const [depths, setDepths] = useState<Set<string>>(() => new Set());
  const [sheetZone, setSheetZone] = useState<FishingZone | null>(null);

  const filtering = isFiltering(segment, depths);
  const counts = depthCounts(room.zones, segment);
  const total = room.zones.length;
  const matchCount = filterZones(room.zones, segment, depths).length;

  const toggleDepth = (name: string) => {
    setDepths((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const resetFilters = () => {
    setSegment('all');
    setDepths(new Set());
  };

  return (
    <div className={styles.stack}>
      <div className={styles.segment}>
        {SEGMENTS.map((seg) => (
          <button
            key={seg.id}
            type="button"
            className={`${styles.segmentBtn} ${segment === seg.id ? styles.segmentBtnActive : ''}`}
            aria-pressed={segment === seg.id}
            onClick={() => setSegment(seg.id)}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className={styles.depthRow}>
        {FISHING_DEPTHS.map((depth) => {
          const selected = depths.has(depth.name);
          const count = counts.get(depth.name) ?? 0;
          return (
            <button
              key={depth.name}
              type="button"
              className={styles.depthChip}
              aria-pressed={selected}
              // Nothing to match in this room / segment - unless selected, so it can be cleared.
              disabled={count === 0 && !selected}
              onClick={() => toggleDepth(depth.name)}
              style={{
                borderColor: depth.color,
                background: selected ? depth.color : withAlpha(depth.color, 0.18),
                color: selected ? '#000' : depth.color,
              }}
            >
              {depth.name} <span className={styles.depthCount}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.filterStatus}>
        <span aria-live="polite">
          {!filtering
            ? `${total} zones`
            : matchCount === 0
              ? 'No zones match these filters'
              : `${matchCount} of ${total} zones match`}
        </span>
        {filtering && (
          <button type="button" className={styles.resetBtn} onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </div>

      {/* Every cell keeps its place on the map: a filter dims the others instead of removing them. */}
      <div className={styles.grid}>
        {room.zones.map((zone) => {
          const match = matchesFilter(zone, segment, depths);
          const stateClass = !filtering ? '' : match ? styles.cellMatch : styles.cellDimmed;
          const interaction = match
            ? { onClick: () => setSheetZone(zone) }
            : { 'aria-disabled': true, tabIndex: -1 };
          if (!zone.accessible) {
            return (
              <button
                key={zone.id}
                type="button"
                className={`${styles.cell} ${styles.cellReef} ${stateClass}`}
                aria-label={`Zone ${zone.id} (Reef)`}
                {...interaction}
              >
                ×
              </button>
            );
          }
          const color = depthFromName(zone.depth)?.color ?? UNKNOWN_DEPTH_COLOR;
          const cellStyle = {
            background: withAlpha(color, 0.55),
            borderColor: color,
            color: '#fff',
            '--cell-color': color,
          } as CSSProperties;
          return (
            <button
              key={zone.id}
              type="button"
              className={`${styles.cell} ${stateClass}`}
              aria-label={`Zone ${zone.id}`}
              style={cellStyle}
              {...interaction}
            >
              {zone.id}
            </button>
          );
        })}
      </div>

      <BottomSheet
        open={sheetZone !== null}
        onClose={() => setSheetZone(null)}
        heightFraction={0.6}
        radius={20}
        ariaLabel="Zone details"
      >
        {sheetZone !== null && (
          <div className={styles.sheetPad}>
            <ZoneSummaryCard
              zone={sheetZone}
              showsZoneNumber
              favorite={favSet.has(String(sheetZone.id))}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
