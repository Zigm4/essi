import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { withAlpha } from '../../design-system/color';
import { BottomSheet } from './shared/BottomSheet';
import { useFavoriteSet } from './shared/favorites';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { ZoneSummaryCard } from './fishing/ZoneSummaryCard';
import {
  FISHING_DEPTHS,
  depthFromName,
  filterZones,
  type FishingRoom,
  type FishingSegment,
  type FishingZone,
} from './fishing/fishingData';
import { useFishingRooms } from './fishing/useFishingData';
import styles from './fishing/Fishing.module.css';

const UNKNOWN_DEPTH_COLOR = '#4F6A87';
const SEGMENTS: readonly { id: FishingSegment; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'known', label: 'Known' },
  { id: 'unknown', label: 'Unknown' },
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

  const visible = filterZones(room.zones, segment, depths);

  const toggleDepth = (name: string) => {
    setDepths((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
          return (
            <button
              key={depth.name}
              type="button"
              className={styles.depthChip}
              aria-pressed={selected}
              onClick={() => toggleDepth(depth.name)}
              style={{
                borderColor: depth.color,
                background: selected ? depth.color : withAlpha(depth.color, 0.18),
                color: selected ? '#000' : depth.color,
              }}
            >
              {depth.name}
            </button>
          );
        })}
      </div>

      <div className={styles.grid}>
        {visible.map((zone) => {
          if (!zone.accessible) {
            return (
              <button
                key={zone.id}
                type="button"
                className={`${styles.cell} ${styles.cellReef}`}
                aria-label={`Zone ${zone.id} (Reef)`}
                onClick={() => setSheetZone(zone)}
              >
                ×
              </button>
            );
          }
          const color = depthFromName(zone.depth)?.color ?? UNKNOWN_DEPTH_COLOR;
          return (
            <button
              key={zone.id}
              type="button"
              className={styles.cell}
              aria-label={`Zone ${zone.id}`}
              onClick={() => setSheetZone(zone)}
              style={{ background: withAlpha(color, 0.55), borderColor: color, color: '#fff' }}
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
