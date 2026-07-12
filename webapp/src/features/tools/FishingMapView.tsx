import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { withAlpha } from '../../design-system/color';
import { IconChevronRight, IconGridView, IconMap } from '../../design-system/icons';
import { IconPlace } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { depthFromName, type FishingRoom } from './fishing/fishingData';
import { useFishingRooms } from './fishing/useFishingData';
import styles from './fishing/Fishing.module.css';

const ACCENT_PRIMARY = '#4FC3FF';

/** /tools/fishing - the four map rooms + the Rankle River grid. */
export function FishingMapView() {
  const navigate = useNavigate();
  const { rooms, error } = useFishingRooms();

  return (
    <ToolScaffold title="Fishing Map">
      {error !== null ? (
        <CenteredError message={error} />
      ) : rooms === null ? (
        <CenteredSpinner />
      ) : (
        <div className={styles.stack}>
          <SectionHeader title="Map rooms" icon={<IconMap size={18} />} />
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onTap={() => navigate(`/tools/fishing/${room.id}`)}
            />
          ))}
        </div>
      )}
    </ToolScaffold>
  );
}

function RoomCard({ room, onTap }: { room: FishingRoom; onTap: () => void }) {
  const firstDepth = depthFromName(room.zones[0]?.depth ?? null);
  const circleColor = firstDepth?.color ?? ACCENT_PRIMARY;
  return (
    <GlassCard onTap={onTap} ariaLabel={room.name}>
      <div className={styles.roomCard}>
        <span className={styles.roomCircle} style={{ background: withAlpha(circleColor, 0.35) }}>
          {room.isSolo ? <IconPlace size={22} /> : <IconGridView size={22} />}
        </span>
        <div className={styles.roomMid}>
          <div className={styles.roomName}>{room.name}</div>
          <div className={styles.roomSub}>
            {room.isSolo ? 'Single zone' : `${room.zones.length} zones`}
          </div>
        </div>
        <span className={styles.chevron}>
          <IconChevronRight size={22} />
        </span>
      </div>
    </GlassCard>
  );
}
