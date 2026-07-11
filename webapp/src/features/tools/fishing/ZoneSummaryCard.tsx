import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { NeonButton } from '../../../design-system/components/NeonButton';
import { withAlpha } from '../../../design-system/color';
import { IconMap } from '../../../design-system/icons';
import { FavoriteButton } from '../shared/FavoriteButton';
import { IconIosShare } from '../shared/toolIcons';
import { shareOrCopy } from '../shared/share';
import { depthFromName, roomDisplayName, type FishingZone } from './fishingData';
import styles from './Fishing.module.css';

/** Zone summary card (spec §4.4). */
export function ZoneSummaryCard({
  zone,
  showsZoneNumber,
  favorite,
}: {
  zone: FishingZone;
  showsZoneNumber: boolean;
  favorite: boolean;
}) {
  const navigate = useNavigate();
  const depth = depthFromName(zone.depth);

  const onShare = () => {
    const lines = [
      `Fishing zone ${zone.id}${zone.name !== 'Unknown' ? ` — ${zone.name}` : ''}`,
      `Room: ${roomDisplayName(zone.room)}`,
      `Depth: ${zone.depth ?? 'n/a'}`,
      `Pole: ${zone.pole ?? 'n/a'}`,
      `Access: ${zone.accessible ? 'Accessible' : 'No (Reef)'}`,
    ];
    void shareOrCopy('Underdeck fishing zone', lines.join('\n'));
  };

  return (
    <GlassCard>
      <div className={styles.zoneHeader}>
        <div className={styles.zoneNameCol}>
          {showsZoneNumber && <div className={styles.zoneNumber}>{`Zone ${zone.id}`}</div>}
          <div className={styles.zoneName}>{zone.name}</div>
        </div>
        <FavoriteButton
          kind="fishing_zone"
          id={String(zone.id)}
          active={favorite}
          size={22}
          tooltip="Star zone"
        />
        <button
          type="button"
          className={styles.zoneShare}
          aria-label="Share zone"
          title="Share zone"
          onClick={onShare}
        >
          <IconIosShare size={18} />
        </button>
        {depth !== null && (
          <span className={styles.zoneCircle} style={{ background: withAlpha(depth.color, 0.55) }} />
        )}
      </div>

      <div className={styles.zoneDivider} />

      <ZoneRow label="Accessible" value={zone.accessible ? 'Yes' : 'No (Reef)'} />
      <ZoneRow label="Depth" value={zone.depth ?? 'n/a'} />
      <ZoneRow label="Pole" value={zone.pole ?? 'n/a'} />

      {zone.mapRef != null && (
        <NeonButton
          className={styles.viewMap}
          title="View on map"
          icon={<IconMap size={18} />}
          onPressed={() => {
            const { mapId, zoneId } = zone.mapRef!;
            navigate(`/knowledge/maps/${mapId}${zoneId !== undefined ? `?zone=${zoneId}` : ''}`);
          }}
        />
      )}
    </GlassCard>
  );
}

function ZoneRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.zoneDetailRow}>
      <span className={styles.zoneDetailLabel}>{label}</span>
      <span className={styles.zoneDetailValue}>{value}</span>
    </div>
  );
}
